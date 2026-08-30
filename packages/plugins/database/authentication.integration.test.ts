import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';
import { createUuidV7, normalizeAccountEmail } from '@protege-mais/common';
import { databaseEnvironment } from '@protege-mais/config';
import type {
  AccountAuthenticationRepository,
  AuthenticationEventLogger,
} from '@protege-mais/interfaces';
import { accounts } from '@protege-mais/models';
import { DrizzleAccountAuthenticationRepository } from '@protege-mais/repositories';
import {
  Argon2idPasswordHashService,
  StructuredAuthenticationAudit,
} from '@protege-mais/services';
import {
  AuthenticateWithEmailAndPassword,
  InvalidCredentialsError,
} from '@protege-mais/use-cases';
import { eq, inArray, sql } from 'drizzle-orm';
import { createDatabaseConnection, type DatabaseLogger } from './index.js';

const databaseLogger: DatabaseLogger = {
  info: () => undefined,
  warn: () => undefined,
};

const validPassword = 'frase segura para integrar PROT-022';

function captureAuthenticationEvents() {
  const contexts: Readonly<Record<string, unknown>>[] = [];
  const messages: string[] = [];
  const logger: AuthenticationEventLogger = {
    info: (context, message) => {
      contexts.push(context);
      messages.push(message);
    },
    warn: (context, message) => {
      contexts.push(context);
      messages.push(message);
    },
  };

  return {
    audit: new StructuredAuthenticationAudit(logger),
    contexts,
    messages,
  };
}

async function invalidCredentialSignature(
  task: Promise<unknown>
): Promise<string> {
  let signature = '';

  await assert.rejects(task, (error: unknown) => {
    assert.ok(error instanceof InvalidCredentialsError);
    signature = JSON.stringify({
      code: error.code,
      message: error.message,
      messageKey: error.messageKey,
      statusCode: error.statusCode,
    });
    return true;
  });

  return signature;
}

void test('autentica hash Argon2id e registra o último login sem criar sessão', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:authentication-valid',
    logger: databaseLogger,
  });
  const accountId = createUuidV7();
  const suffix = createUuidV7().replaceAll('-', '');
  const email = `authentication.${suffix}@example.test`;
  const passwordHashes = new Argon2idPasswordHashService();
  const passwordHash = await passwordHashes.hash(validPassword);
  const occurredAt = new Date(Date.now() + 60_000);
  const events = captureAuthenticationEvents();

  try {
    await connection.connect();
    await connection.database.insert(accounts).values({
      id: accountId,
      email,
      emailNormalized: normalizeAccountEmail(email),
      passwordHash,
      type: 'person',
      status: 'active',
      mfaEnabled: false,
    });
    const repository = new DrizzleAccountAuthenticationRepository(
      connection.database
    );
    const subject = new AuthenticateWithEmailAndPassword(
      repository,
      passwordHashes,
      events.audit,
      { now: () => occurredAt }
    );

    const authenticated = await subject.execute({
      email: `  ${email.toUpperCase()}  `,
      password: validPassword,
    });

    assert.deepEqual(authenticated, { accountId, mfaEnabled: false });
    const persisted = await connection.database
      .select({
        lastLoginAt: accounts.lastLoginAt,
        updatedAt: accounts.updatedAt,
        version: accounts.version,
      })
      .from(accounts)
      .where(eq(accounts.id, accountId));
    assert.deepEqual(persisted[0], {
      lastLoginAt: occurredAt,
      updatedAt: occurredAt,
      version: 2,
    });

    const sessions = await connection.pool.query<{ readonly total: number }>(
      `
        SELECT count(*)::integer AS total
        FROM auth_sessions
        WHERE account_id = $1
      `,
      [accountId]
    );
    assert.equal(sessions.rows[0]?.total, 0);
    assert.deepEqual(events.contexts, [{ event: 'authentication.succeeded' }]);
  } finally {
    await connection.database
      .delete(accounts)
      .where(eq(accounts.id, accountId));
    await connection.close();
  }
});

void test('falhas reais são não enumeráveis e mantêm custo comparável', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:authentication-invalid',
    logger: databaseLogger,
  });
  const suffix = createUuidV7().replaceAll('-', '');
  const passwordHashes = new Argon2idPasswordHashService();
  const accountDefinitions = [
    {
      id: createUuidV7(),
      label: 'wrong',
      status: 'active' as const,
      passwordHash: await passwordHashes.hash(`${validPassword} active`),
    },
    {
      id: createUuidV7(),
      label: 'blocked',
      status: 'blocked' as const,
      passwordHash: await passwordHashes.hash(`${validPassword} blocked`),
    },
    {
      id: createUuidV7(),
      label: 'disabled',
      status: 'disabled' as const,
      passwordHash: await passwordHashes.hash(`${validPassword} disabled`),
    },
  ];
  const externalAccountId = createUuidV7();
  const accountIds = [
    ...accountDefinitions.map((definition) => definition.id),
    externalAccountId,
  ];
  const events = captureAuthenticationEvents();

  try {
    await connection.connect();
    await connection.database.insert(accounts).values([
      ...accountDefinitions.map((definition) => {
        const email = `${definition.label}.${suffix}@example.test`;
        return {
          id: definition.id,
          email,
          emailNormalized: normalizeAccountEmail(email),
          passwordHash: definition.passwordHash,
          type: 'person' as const,
          status: definition.status,
          mfaEnabled: false,
        };
      }),
      {
        id: externalAccountId,
        email: `external.${suffix}@example.test`,
        emailNormalized: `external.${suffix}@example.test`,
        externalProvider: 'oidc_test',
        externalSubject: `subject-${suffix}`,
        type: 'person' as const,
        status: 'active' as const,
        mfaEnabled: false,
      },
    ]);
    const repository = new DrizzleAccountAuthenticationRepository(
      connection.database
    );
    const subject = new AuthenticateWithEmailAndPassword(
      repository,
      passwordHashes,
      events.audit,
      { now: () => new Date() }
    );
    const attempts = [
      {
        email: `wrong.${suffix}@example.test`,
        password: 'senha errada, mas suficientemente longa',
      },
      {
        email: `blocked.${suffix}@example.test`,
        password: `${validPassword} blocked`,
      },
      {
        email: `disabled.${suffix}@example.test`,
        password: `${validPassword} disabled`,
      },
      {
        email: `external.${suffix}@example.test`,
        password: validPassword,
      },
      {
        email: `missing.${suffix}@example.test`,
        password: validPassword,
      },
    ];
    const signatures: string[] = [];
    const durations: number[] = [];

    for (const attempt of attempts) {
      const startedAt = performance.now();
      signatures.push(
        await invalidCredentialSignature(subject.execute(attempt))
      );
      durations.push(performance.now() - startedAt);
    }

    assert.equal(new Set(signatures).size, 1);
    assert.equal(
      durations.every((duration) => duration > 5),
      true
    );
    assert.equal(Math.max(...durations) / Math.min(...durations) < 4, true);
    const persisted = await connection.database
      .select({
        lastLoginAt: accounts.lastLoginAt,
        version: accounts.version,
      })
      .from(accounts)
      .where(inArray(accounts.id, accountIds));
    assert.equal(persisted.length, accountIds.length);
    assert.equal(
      persisted.every(
        (account) => account.lastLoginAt === null && account.version === 1
      ),
      true
    );
    assert.deepEqual(
      events.contexts,
      attempts.map(() => ({ event: 'authentication.failed' }))
    );
    const serializedAudit = JSON.stringify({
      contexts: events.contexts,
      messages: events.messages,
    });
    assert.doesNotMatch(
      serializedAudit,
      new RegExp(`${suffix}|${validPassword}`, 'u')
    );
  } finally {
    await connection.database
      .delete(accounts)
      .where(inArray(accounts.id, accountIds));
    await connection.close();
  }
});

void test('mudança concorrente de estado invalida o login já verificado', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:authentication-race',
    logger: databaseLogger,
  });
  const accountId = createUuidV7();
  const suffix = createUuidV7().replaceAll('-', '');
  const email = `race.${suffix}@example.test`;
  const passwordHashes = new Argon2idPasswordHashService();
  const passwordHash = await passwordHashes.hash(validPassword);
  const events = captureAuthenticationEvents();

  try {
    await connection.connect();
    await connection.database.insert(accounts).values({
      id: accountId,
      email,
      emailNormalized: normalizeAccountEmail(email),
      passwordHash,
      type: 'person',
      status: 'active',
      mfaEnabled: false,
    });
    const delegate = new DrizzleAccountAuthenticationRepository(
      connection.database
    );
    const racingRepository: AccountAuthenticationRepository = {
      findByNormalizedEmail: (emailNormalized) =>
        delegate.findByNormalizedEmail(emailNormalized),
      recordSuccessfulLogin: async (input) => {
        await connection.database
          .update(accounts)
          .set({
            status: 'blocked',
            updatedAt: new Date(),
            version: sql<number>`${accounts.version} + 1`,
          })
          .where(eq(accounts.id, accountId));
        return delegate.recordSuccessfulLogin(input);
      },
    };
    const subject = new AuthenticateWithEmailAndPassword(
      racingRepository,
      passwordHashes,
      events.audit,
      { now: () => new Date(Date.now() + 60_000) }
    );

    await invalidCredentialSignature(
      subject.execute({ email, password: validPassword })
    );

    const persisted = await connection.database
      .select({
        lastLoginAt: accounts.lastLoginAt,
        status: accounts.status,
        version: accounts.version,
      })
      .from(accounts)
      .where(eq(accounts.id, accountId));
    assert.deepEqual(persisted[0], {
      lastLoginAt: null,
      status: 'blocked',
      version: 2,
    });
    assert.deepEqual(events.contexts, [{ event: 'authentication.failed' }]);
  } finally {
    await connection.database
      .delete(accounts)
      .where(eq(accounts.id, accountId));
    await connection.close();
  }
});
