import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createUuidV7,
  normalizeAccountEmail,
  sanitizeAuthSessionDeviceName,
  sanitizeAuthSessionUserAgent,
} from '@protege-mais/common';
import { databaseEnvironment } from '@protege-mais/config';
import {
  accounts,
  authSessionConstraintNames,
  authSessionIndexNames,
  authSessionPublicSelection,
  authSessions,
  serializePublicAuthSession,
} from '@protege-mais/models';
import { and, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import type { PoolClient } from 'pg';
import { createDatabaseConnection, type DatabaseLogger } from './index.js';

const logger: DatabaseLogger = {
  info: () => undefined,
  warn: () => undefined,
};

const insertAccountSql = `
  INSERT INTO accounts (
    id, email, email_normalized, password_hash, type, status, mfa_enabled
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7)
`;

const insertSessionSql = `
  INSERT INTO auth_sessions (
    id,
    account_id,
    refresh_token_hash,
    device_identifier,
    device_name,
    ip_hash,
    user_agent,
    expires_at,
    last_used_at,
    revoked_at,
    created_at
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
`;

interface DatabaseErrorExpectation {
  readonly code: string;
  readonly constraint?: string;
}

function matchesDatabaseError(
  error: unknown,
  expectation: DatabaseErrorExpectation
): boolean {
  if (typeof error !== 'object' || error === null) return false;

  if ('code' in error && error.code === expectation.code) {
    return (
      expectation.constraint === undefined ||
      ('constraint' in error && error.constraint === expectation.constraint)
    );
  }

  return 'cause' in error && matchesDatabaseError(error.cause, expectation);
}

let savepointSequence = 0;

async function rejectsAtSavepoint(
  client: PoolClient,
  statement: string,
  values: unknown[],
  expectation: DatabaseErrorExpectation
): Promise<void> {
  savepointSequence += 1;
  const savepoint = `auth_session_rejection_${savepointSequence}`;

  await client.query(`SAVEPOINT ${savepoint}`);
  await assert.rejects(client.query(statement, values), (error: unknown) =>
    matchesDatabaseError(error, expectation)
  );
  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
}

function sessionValues(input: {
  readonly accountId: string;
  readonly createdAt: Date;
  readonly deviceIdentifier?: string;
  readonly deviceName?: string | null;
  readonly expiresAt?: Date;
  readonly id?: string;
  readonly ipHash?: string | null;
  readonly lastUsedAt?: Date | null;
  readonly refreshTokenHash?: string;
  readonly revokedAt?: Date | null;
  readonly userAgent?: string | null;
}): unknown[] {
  return [
    input.id ?? createUuidV7(),
    input.accountId,
    input.refreshTokenHash ?? `refresh-hash-${createUuidV7()}`,
    input.deviceIdentifier ?? `device-${createUuidV7()}`,
    input.deviceName ?? null,
    input.ipHash ?? null,
    input.userAgent ?? null,
    input.expiresAt ?? new Date(input.createdAt.getTime() + 60_000),
    input.lastUsedAt ?? null,
    input.revokedAt ?? null,
    input.createdAt,
  ];
}

void test('sessão ativa é localizada pelo hash sem expor metadados internos', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:auth-session-active',
    logger,
  });
  const accountId = createUuidV7();
  const sessionIds = [createUuidV7(), createUuidV7(), createUuidV7()] as const;
  const suffix = createUuidV7().replaceAll('-', '');
  const now = new Date();
  const activeHash = `active-hash-${suffix}`;
  const expiredHash = `expired-hash-${suffix}`;
  const revokedHash = `revoked-hash-${suffix}`;

  try {
    await connection.connect();
    await connection.database.insert(accounts).values({
      id: accountId,
      email: `session.${suffix}@example.test`,
      emailNormalized: normalizeAccountEmail(`session.${suffix}@example.test`),
      passwordHash: 'test-only-password-hash',
      type: 'person',
      status: 'active',
      mfaEnabled: false,
    });

    const [activeSession] = await connection.database
      .insert(authSessions)
      .values({
        id: sessionIds[0],
        accountId,
        refreshTokenHash: activeHash,
        deviceIdentifier: `device-${suffix}`,
        deviceName: sanitizeAuthSessionDeviceName('  Notebook\nseguro  '),
        ipHash: `ip-hash-${suffix}`,
        userAgent: sanitizeAuthSessionUserAgent(' Browser/1.0\r\n Test '),
        expiresAt: new Date(now.getTime() + 60_000),
      })
      .returning();
    assert.ok(activeSession);

    await connection.database.insert(authSessions).values([
      {
        id: sessionIds[1],
        accountId,
        refreshTokenHash: expiredHash,
        deviceIdentifier: `expired-${suffix}`,
        expiresAt: new Date(now.getTime() - 1_000),
        createdAt: new Date(now.getTime() - 60_000),
      },
      {
        id: sessionIds[2],
        accountId,
        refreshTokenHash: revokedHash,
        deviceIdentifier: `revoked-${suffix}`,
        expiresAt: new Date(now.getTime() + 60_000),
        revokedAt: now,
        createdAt: new Date(now.getTime() - 1_000),
      },
    ]);

    const activeResult = await connection.database
      .select(authSessionPublicSelection)
      .from(authSessions)
      .where(
        and(
          eq(authSessions.refreshTokenHash, activeHash),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, now)
        )
      );
    assert.equal(activeResult.length, 1);
    assert.equal(activeResult[0]?.id, sessionIds[0]);
    assert.equal(
      Object.hasOwn(activeResult[0] ?? {}, 'refreshTokenHash'),
      false
    );
    assert.equal(Object.hasOwn(activeResult[0] ?? {}, 'ipHash'), false);
    assert.equal(Object.hasOwn(activeResult[0] ?? {}, 'accountId'), false);

    for (const inactiveHash of [expiredHash, revokedHash]) {
      const result = await connection.database
        .select(authSessionPublicSelection)
        .from(authSessions)
        .where(
          and(
            eq(authSessions.refreshTokenHash, inactiveHash),
            isNull(authSessions.revokedAt),
            gt(authSessions.expiresAt, now)
          )
        );
      assert.equal(result.length, 0);
    }

    const publicSession = serializePublicAuthSession(activeSession);
    assert.equal(Object.hasOwn(publicSession, 'refreshTokenHash'), false);
    assert.equal(Object.hasOwn(publicSession, 'ipHash'), false);
    assert.equal(JSON.stringify(publicSession).includes(activeHash), false);
    assert.equal(
      JSON.stringify(publicSession).includes(`ip-hash-${suffix}`),
      false
    );

    const client = await connection.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL enable_seqscan = off');
      const hashPlan = await client.query<{ readonly 'QUERY PLAN': string }>(
        `
          EXPLAIN (COSTS OFF)
          SELECT id
          FROM auth_sessions
          WHERE refresh_token_hash = $1
            AND revoked_at IS NULL
            AND expires_at > $2
        `,
        [activeHash, now]
      );
      assert.match(
        hashPlan.rows.map((row) => row['QUERY PLAN']).join('\n'),
        new RegExp(authSessionIndexNames.refreshTokenHash, 'u')
      );

      const accountPlan = await client.query<{
        readonly 'QUERY PLAN': string;
      }>(
        `
          EXPLAIN (COSTS OFF)
          SELECT id
          FROM auth_sessions
          WHERE account_id = $1
            AND revoked_at IS NULL
            AND expires_at > $2
        `,
        [accountId, now]
      );
      assert.match(
        accountPlan.rows.map((row) => row['QUERY PLAN']).join('\n'),
        new RegExp(authSessionIndexNames.accountLifecycle, 'u')
      );
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  } finally {
    await connection.database
      .delete(authSessions)
      .where(inArray(authSessions.id, sessionIds));
    await connection.database
      .delete(accounts)
      .where(eq(accounts.id, accountId));
    await connection.close();
  }
});

void test('constraints protegem hashes, metadados, ciclo de vida e histórico', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:auth-session-constraints',
    logger,
  });
  const client = await connection.pool.connect();
  const accountId = createUuidV7();
  const suffix = createUuidV7().replaceAll('-', '');
  const email = `constraints.${suffix}@example.test`;
  const createdAt = new Date();
  const validHash = `valid-hash-${suffix}`;

  try {
    await client.query('BEGIN');
    await client.query(insertAccountSql, [
      accountId,
      email,
      normalizeAccountEmail(email),
      'test-only-password-hash',
      'person',
      'active',
      false,
    ]);
    await client.query(
      insertSessionSql,
      sessionValues({ accountId, createdAt, refreshTokenHash: validHash })
    );

    await rejectsAtSavepoint(
      client,
      insertSessionSql,
      sessionValues({ accountId, createdAt, refreshTokenHash: validHash }),
      { code: '23505', constraint: authSessionIndexNames.refreshTokenHash }
    );
    await rejectsAtSavepoint(
      client,
      insertSessionSql,
      sessionValues({
        accountId: createUuidV7(),
        createdAt,
      }),
      {
        code: '23503',
        constraint: authSessionConstraintNames.accountForeignKey,
      }
    );
    await rejectsAtSavepoint(
      client,
      insertSessionSql,
      sessionValues({
        accountId,
        createdAt,
        refreshTokenHash: 'hash com espaço',
      }),
      { code: '23514', constraint: 'auth_sessions_refresh_token_hash_check' }
    );
    await rejectsAtSavepoint(
      client,
      insertSessionSql,
      sessionValues({
        accountId,
        createdAt,
        deviceIdentifier: 'device inválido',
      }),
      { code: '23514', constraint: 'auth_sessions_device_identifier_check' }
    );
    await rejectsAtSavepoint(
      client,
      insertSessionSql,
      sessionValues({ accountId, createdAt, deviceName: 'Nome\ncru' }),
      { code: '23514', constraint: 'auth_sessions_device_name_check' }
    );
    await rejectsAtSavepoint(
      client,
      insertSessionSql,
      sessionValues({ accountId, createdAt, ipHash: 'ip hash cru' }),
      { code: '23514', constraint: 'auth_sessions_ip_hash_check' }
    );
    await rejectsAtSavepoint(
      client,
      insertSessionSql,
      sessionValues({ accountId, createdAt, userAgent: 'Agent\r\ncru' }),
      { code: '23514', constraint: 'auth_sessions_user_agent_check' }
    );
    await rejectsAtSavepoint(
      client,
      insertSessionSql,
      sessionValues({ accountId, createdAt, expiresAt: createdAt }),
      { code: '23514', constraint: 'auth_sessions_lifecycle_check' }
    );

    await rejectsAtSavepoint(
      client,
      'DELETE FROM accounts WHERE id = $1',
      [accountId],
      {
        code: '23503',
        constraint: authSessionConstraintNames.accountForeignKey,
      }
    );
    await client.query(
      `
        UPDATE accounts
        SET deleted_at = now(), updated_at = now(), version = version + 1
        WHERE id = $1
      `,
      [accountId]
    );
    const preserved = await client.query<{ readonly total: number }>(
      'SELECT count(*)::integer AS total FROM auth_sessions WHERE account_id = $1',
      [accountId]
    );
    assert.equal(preserved.rows[0]?.total, 1);
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await connection.close();
  }
});

void test('revogação concorrente altera a sessão exatamente uma vez', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:auth-session-revocation',
    logger,
  });
  const accountId = createUuidV7();
  const sessionId = createUuidV7();
  const suffix = createUuidV7().replaceAll('-', '');
  const now = new Date();

  try {
    await connection.connect();
    const email = `revoke.${suffix}@example.test`;
    await connection.database.insert(accounts).values({
      id: accountId,
      email,
      emailNormalized: normalizeAccountEmail(email),
      passwordHash: 'test-only-password-hash',
      type: 'person',
      status: 'active',
      mfaEnabled: false,
    });
    await connection.database.insert(authSessions).values({
      id: sessionId,
      accountId,
      refreshTokenHash: `revoke-hash-${suffix}`,
      deviceIdentifier: `device-${suffix}`,
      expiresAt: new Date(now.getTime() + 60_000),
    });
    const revocationAt = new Date();

    const attempts = await Promise.all([
      connection.database
        .update(authSessions)
        .set({
          revokedAt: revocationAt,
          updatedAt: revocationAt,
          version: sql`${authSessions.version} + 1`,
        })
        .where(
          and(
            eq(authSessions.id, sessionId),
            isNull(authSessions.revokedAt),
            gt(authSessions.expiresAt, revocationAt),
            eq(authSessions.version, 1)
          )
        )
        .returning({ id: authSessions.id }),
      connection.database
        .update(authSessions)
        .set({
          revokedAt: revocationAt,
          updatedAt: revocationAt,
          version: sql`${authSessions.version} + 1`,
        })
        .where(
          and(
            eq(authSessions.id, sessionId),
            isNull(authSessions.revokedAt),
            gt(authSessions.expiresAt, revocationAt),
            eq(authSessions.version, 1)
          )
        )
        .returning({ id: authSessions.id }),
    ]);

    assert.deepEqual(attempts.map((attempt) => attempt.length).sort(), [0, 1]);
    const [stored] = await connection.database
      .select({
        revokedAt: authSessions.revokedAt,
        version: authSessions.version,
      })
      .from(authSessions)
      .where(eq(authSessions.id, sessionId));
    assert.equal(stored?.revokedAt?.getTime(), revocationAt.getTime());
    assert.equal(stored?.version, 2);
  } finally {
    await connection.database
      .delete(authSessions)
      .where(eq(authSessions.id, sessionId));
    await connection.database
      .delete(accounts)
      .where(eq(accounts.id, accountId));
    await connection.close();
  }
});
