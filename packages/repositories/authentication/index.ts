import { and, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  type AccountAuthenticationRepository,
  type AuthenticationAccountRecord,
  type RecordSuccessfulLoginInput,
} from '@protege-mais/interfaces';
import { accounts } from '@protege-mais/models';
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
