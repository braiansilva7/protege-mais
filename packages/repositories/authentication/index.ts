import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  type AccountAuthenticationRepository,
  type AuthenticationSessionRepository,
  type AuthenticationAccountRecord,
  type CreateAuthenticationSessionInput,
  type RecordSuccessfulLoginInput,
  type RotateAuthenticationSessionInput,
  type RotateAuthenticationSessionResult,
} from '@protege-mais/interfaces';
import { accounts, authSessions } from '@protege-mais/models';
import * as schema from '@protege-mais/models';

type AuthenticationDatabase = NodePgDatabase<typeof schema>;

export class DrizzleAccountAuthenticationRepository implements AccountAuthenticationRepository {
  public constructor(private readonly database: AuthenticationDatabase) {}

  public async findByNormalizedEmail(
    emailNormalized: string
  ): Promise<AuthenticationAccountRecord | null> {
    const rows = await this.database
      .select({
        id: accounts.id,
        passwordHash: accounts.passwordHash,
        status: accounts.status,
        mfaEnabled: accounts.mfaEnabled,
      })
      .from(accounts)
      .where(
        and(
          eq(accounts.emailNormalized, emailNormalized),
          isNull(accounts.deletedAt)
        )
      )
      .limit(1);

    return rows[0] ?? null;
  }

  public async recordSuccessfulLogin(
    input: RecordSuccessfulLoginInput
  ): Promise<boolean> {
    const updatedAccounts = await this.database
      .update(accounts)
      .set({
        lastLoginAt: sql<Date>`GREATEST(
          COALESCE(${accounts.lastLoginAt}, ${input.occurredAt}),
          ${input.occurredAt}
        )`,
        updatedAt: sql<Date>`GREATEST(
          ${accounts.updatedAt},
          ${input.occurredAt}
        )`,
        version: sql<number>`${accounts.version} + 1`,
      })
      .where(
        and(
          eq(accounts.id, input.accountId),
          eq(accounts.passwordHash, input.expectedPasswordHash),
          eq(accounts.status, 'active'),
          isNull(accounts.deletedAt)
        )
      )
      .returning({ id: accounts.id });

    return updatedAccounts.length === 1;
  }
}

export class DrizzleAuthenticationSessionRepository implements AuthenticationSessionRepository {
  public constructor(private readonly database: AuthenticationDatabase) {}

  public create(input: CreateAuthenticationSessionInput): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const eligibleAccounts = await transaction
        .select({ id: accounts.id })
        .from(accounts)
        .where(
          and(
            eq(accounts.id, input.accountId),
            eq(accounts.status, 'active'),
            isNull(accounts.deletedAt)
          )
        )
        .limit(1)
        .for('update');

      if (eligibleAccounts.length !== 1) return false;

      await transaction.insert(authSessions).values({
        id: input.id,
        accountId: input.accountId,
        refreshTokenHash: input.refreshTokenHash,
        deviceIdentifier: input.deviceIdentifier,
        deviceName: input.deviceName,
        ipHash: null,
        userAgent: input.userAgent,
        expiresAt: input.expiresAt,
        lastUsedAt: null,
        revokedAt: null,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
        version: 1,
      });

      return true;
    });
  }

  public rotate(
    input: RotateAuthenticationSessionInput
  ): Promise<RotateAuthenticationSessionResult> {
    return this.database.transaction(async (transaction) => {
      const sessions = await transaction
        .select({
          id: authSessions.id,
          refreshTokenHash: authSessions.refreshTokenHash,
        })
        .from(authSessions)
        .innerJoin(accounts, eq(accounts.id, authSessions.accountId))
        .where(
          and(
            eq(authSessions.id, input.sessionId),
            eq(authSessions.accountId, input.accountId),
            eq(authSessions.expiresAt, input.expectedExpiresAt),
            isNull(authSessions.revokedAt),
            gt(authSessions.expiresAt, input.usedAt),
            eq(accounts.status, 'active'),
            isNull(accounts.deletedAt)
          )
        )
        .limit(1)
        .for('update');
      const session = sessions[0];

      if (session === undefined) return 'invalid';

      if (session.refreshTokenHash !== input.presentedRefreshTokenHash) {
        const revoked = await transaction
          .update(authSessions)
          .set({
            revokedAt: input.usedAt,
            updatedAt: sql<Date>`GREATEST(
              ${authSessions.updatedAt},
              ${input.usedAt}
            )`,
            version: sql<number>`${authSessions.version} + 1`,
          })
          .where(
            and(
              eq(authSessions.id, session.id),
              eq(authSessions.refreshTokenHash, session.refreshTokenHash),
              isNull(authSessions.revokedAt),
              gt(authSessions.expiresAt, input.usedAt)
            )
          )
          .returning({ id: authSessions.id });

        return revoked.length === 1 ? 'reused' : 'invalid';
      }

      const rotated = await transaction
        .update(authSessions)
        .set({
          refreshTokenHash: input.successorRefreshTokenHash,
          lastUsedAt: input.usedAt,
          updatedAt: sql<Date>`GREATEST(
            ${authSessions.updatedAt},
            ${input.usedAt}
          )`,
          version: sql<number>`${authSessions.version} + 1`,
        })
        .where(
          and(
            eq(authSessions.id, session.id),
            eq(authSessions.refreshTokenHash, input.presentedRefreshTokenHash),
            isNull(authSessions.revokedAt),
            gt(authSessions.expiresAt, input.usedAt)
          )
        )
        .returning({ id: authSessions.id });

      return rotated.length === 1 ? 'rotated' : 'invalid';
    });
  }
}
