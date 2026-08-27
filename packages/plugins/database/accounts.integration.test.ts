import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createUuidV7, normalizeAccountEmail } from '@protege-mais/common';
import { databaseEnvironment } from '@protege-mais/config';
import {
  accountActiveIdentifierIndexNames,
  accounts,
  serializePublicAccount,
} from '@protege-mais/models';
import { inArray } from 'drizzle-orm';
import type { PoolClient } from 'pg';
import { createDatabaseConnection, type DatabaseLogger } from './index.js';

const logger: DatabaseLogger = {
  info: () => undefined,
  warn: () => undefined,
};

const insertAccountSql = `
  INSERT INTO accounts (
    id,
    email,
    email_normalized,
    phone_e164,
    password_hash,
    external_provider,
    external_subject,
    type,
    status,
    mfa_enabled
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
`;

interface DatabaseErrorExpectation {
  readonly code: string;
  readonly constraint?: string;
}

function matchesDatabaseError(
  error: unknown,
  expectation: DatabaseErrorExpectation
): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

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
  values: unknown[],
  expectation: DatabaseErrorExpectation
): Promise<void> {
  savepointSequence += 1;
  const savepoint = `account_rejection_${savepointSequence}`;

  await client.query(`SAVEPOINT ${savepoint}`);
  await assert.rejects(
    client.query(insertAccountSql, values),
    (error: unknown) => matchesDatabaseError(error, expectation)
  );
  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
}

function localAccountValues(input: {
  readonly email: string;
  readonly id?: string;
  readonly passwordHash?: string;
  readonly phoneE164?: string | null;
}): unknown[] {
  return [
    input.id ?? createUuidV7(),
    input.email,
    normalizeAccountEmail(input.email),
    input.phoneE164 ?? null,
    input.passwordHash ?? 'test-only-password-hash',
    null,
    null,
    'person',
    'active',
    false,
  ];
}

function externalAccountValues(input: {
  readonly externalProvider: string;
  readonly externalSubject: string | null;
  readonly id?: string;
}): unknown[] {
  return [
    input.id ?? createUuidV7(),
    null,
    null,
    null,
    null,
    input.externalProvider,
    input.externalSubject,
    'service',
    'active',
    false,
  ];
}

void test('accounts persiste identidades válidas e projeta resposta segura', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:accounts-valid',
    logger,
  });
  const insertedIds: string[] = [];
  const suffix = createUuidV7().replaceAll('-', '');

  try {
    await connection.connect();

    const email = `Person.${suffix}@Example.TEST`;
    const [localAccount] = await connection.database
      .insert(accounts)
      .values({
        email,
        emailNormalized: normalizeAccountEmail(email),
        phoneE164: '+5511987654321',
        passwordHash: 'test-only-password-hash',
        type: 'person',
        status: 'active',
        mfaEnabled: false,
      })
      .returning();
    assert.ok(localAccount);
    insertedIds.push(localAccount.id);
    assert.equal(localAccount.email, email);
    assert.equal(localAccount.emailNormalized, normalizeAccountEmail(email));
    assert.equal(localAccount.version, 1);
    assert.ok(localAccount.createdAt instanceof Date);

    const publicAccount = serializePublicAccount(localAccount);
    assert.equal(Object.hasOwn(publicAccount, 'passwordHash'), false);
    assert.equal(Object.hasOwn(publicAccount, 'emailNormalized'), false);
    assert.doesNotMatch(
      JSON.stringify(publicAccount),
      /test-only-password-hash/u
    );

    const [externalAccount] = await connection.database
      .insert(accounts)
      .values({
        externalProvider: 'oidc_test',
        externalSubject: `subject-${suffix}`,
        type: 'service',
        status: 'active',
        mfaEnabled: false,
      })
      .returning();
    assert.ok(externalAccount);
    insertedIds.push(externalAccount.id);
    assert.equal(externalAccount.passwordHash, null);
    assert.equal(externalAccount.externalProvider, 'oidc_test');
  } finally {
    if (insertedIds.length > 0) {
      await connection.database
        .delete(accounts)
        .where(inArray(accounts.id, insertedIds));
    }
    await connection.close();
  }
});

void test('accounts rejeita combinações de identidade inconsistentes', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:accounts-constraints',
    logger,
  });
  const client = await connection.pool.connect();
  const suffix = createUuidV7().replaceAll('-', '');

  try {
    await client.query('BEGIN');

    await rejectsAtSavepoint(
      client,
      [
        createUuidV7(),
        null,
        null,
        null,
        null,
        null,
        null,
        'person',
        'active',
        false,
      ],
      { code: '23514', constraint: 'accounts_identity_method_check' }
    );
    await rejectsAtSavepoint(
      client,
      [
        createUuidV7(),
        `Person.${suffix}@Example.TEST`,
        `different.${suffix}@example.test`,
        null,
        'test-only-password-hash',
        null,
        null,
        'person',
        'active',
        false,
      ],
      { code: '23514', constraint: 'accounts_email_normalization_check' }
    );
    await rejectsAtSavepoint(
      client,
      localAccountValues({
        email: `phone.${suffix}@example.test`,
        phoneE164: '5511987654321',
      }),
      { code: '23514', constraint: 'accounts_phone_e164_check' }
    );
    await rejectsAtSavepoint(
      client,
      localAccountValues({
        email: `hash.${suffix}@example.test`,
        passwordHash: '',
      }),
      { code: '23514', constraint: 'accounts_password_hash_check' }
    );
    await rejectsAtSavepoint(
      client,
      [
        createUuidV7(),
        `external.${suffix}@example.test`,
        `external.${suffix}@example.test`,
        null,
        'test-only-password-hash',
        'oidc_test',
        null,
        'person',
        'active',
        false,
      ],
      { code: '23514', constraint: 'accounts_external_identity_check' }
    );
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await connection.close();
  }
});

void test('identificadores ativos conflitam e podem ser reutilizados após soft delete', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:accounts-reuse',
    logger,
  });
  const client = await connection.pool.connect();
  const suffix = createUuidV7().replaceAll('-', '');
  const originalId = createUuidV7();
  const originalEmail = `Reuse.${suffix}@Example.TEST`;

  try {
    await client.query('BEGIN');
    await client.query(
      insertAccountSql,
      localAccountValues({
        id: originalId,
        email: originalEmail,
        phoneE164: '+5511976543210',
      })
    );
    await client.query(
      insertAccountSql,
      externalAccountValues({
        externalProvider: 'oidc_test',
        externalSubject: `subject-${suffix}`,
      })
    );

    await rejectsAtSavepoint(
      client,
      localAccountValues({ email: originalEmail.toUpperCase() }),
      { code: '23505', constraint: accountActiveIdentifierIndexNames.email }
    );
    await rejectsAtSavepoint(
      client,
      localAccountValues({
        email: `other.${suffix}@example.test`,
        phoneE164: '+5511976543210',
      }),
      { code: '23505', constraint: accountActiveIdentifierIndexNames.phoneE164 }
    );
    await rejectsAtSavepoint(
      client,
      externalAccountValues({
        externalProvider: 'oidc_test',
        externalSubject: `subject-${suffix}`,
      }),
      {
        code: '23505',
        constraint: accountActiveIdentifierIndexNames.externalIdentity,
      }
    );

    await client.query(
      `
        UPDATE accounts
        SET deleted_at = now(), updated_at = now(), version = version + 1
        WHERE id = $1
      `,
      [originalId]
    );
    await client.query(
      insertAccountSql,
      localAccountValues({ email: originalEmail.toUpperCase() })
    );

    await client.query('SAVEPOINT account_restore_conflict');
    await assert.rejects(
      client.query(
        `
          UPDATE accounts
          SET deleted_at = NULL, updated_at = now(), version = version + 1
          WHERE id = $1
        `,
        [originalId]
      ),
      (error: unknown) =>
        matchesDatabaseError(error, {
          code: '23505',
          constraint: accountActiveIdentifierIndexNames.email,
        })
    );
    await client.query('ROLLBACK TO SAVEPOINT account_restore_conflict');

    await client.query('SET LOCAL enable_seqscan = off');
    const plan = await client.query<{ readonly 'QUERY PLAN': string }>(
      `
        EXPLAIN (COSTS OFF)
        SELECT id
        FROM accounts
        WHERE email_normalized = $1 AND deleted_at IS NULL
      `,
      [normalizeAccountEmail(originalEmail)]
    );
    assert.match(
      plan.rows.map((row) => row['QUERY PLAN']).join('\n'),
      new RegExp(accountActiveIdentifierIndexNames.email, 'u')
    );
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await connection.close();
  }
});

void test('unicidade de e-mail permanece atômica sob inserts concorrentes', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:accounts-concurrency',
    logger,
  });
  const accountIds = [createUuidV7(), createUuidV7()] as const;
  const suffix = createUuidV7().replaceAll('-', '');
  const email = `concurrent.${suffix}@example.test`;

  try {
    await connection.connect();
    const results = await Promise.allSettled(
      accountIds.map((id) =>
        connection.database.insert(accounts).values({
          id,
          email,
          emailNormalized: normalizeAccountEmail(email),
          passwordHash: 'test-only-password-hash',
          type: 'person',
          status: 'active',
          mfaEnabled: false,
        })
      )
    );
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(
      rejected.every((result) =>
        matchesDatabaseError(result.reason, {
          code: '23505',
          constraint: accountActiveIdentifierIndexNames.email,
        })
      ),
      true
    );
  } finally {
    await connection.database
      .delete(accounts)
      .where(inArray(accounts.id, accountIds));
    await connection.close();
  }
});
