import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createUuidV7, normalizeAccountEmail } from '@protege-mais/common';
import { databaseEnvironment } from '@protege-mais/config';
import type {
  AuthenticationEventLogger,
  AuthenticationSessionAudit,
} from '@protege-mais/interfaces';
import { accounts, authSessions } from '@protege-mais/models';
import {
  DrizzleAccountAuthenticationRepository,
  DrizzleAuthenticationSessionRepository,
} from '@protege-mais/repositories';
import {
  Argon2idPasswordHashService,
  JoseAccessTokenService,
  JoseRefreshTokenService,
  Sha256RefreshTokenHashService,
  StructuredAuthenticationAudit,
  StructuredAuthenticationSessionAudit,
  refreshTokenLifetimeSeconds,
} from '@protege-mais/services';
import {
  AuthenticateWithEmailAndPassword,
  InvalidRefreshTokenError,
  LoginWithEmailAndPassword,
  RefreshAuthenticationSession,
} from '@protege-mais/use-cases';
import { eq, inArray, sql } from 'drizzle-orm';
import { createDatabaseConnection, type DatabaseLogger } from './index.js';

const databaseLogger: DatabaseLogger = {
  info: () => undefined,
  warn: () => undefined,
};
const accessSecret = 'integration-access-secret-with-at-least-thirty-two-bytes';
const refreshSecret =
  'integration-refresh-secret-with-at-least-thirty-two-bytes';
const validPassword = 'frase segura para integrar o PROT-024';

function secondPrecision(value: Date): Date {
  return new Date(Math.floor(value.getTime() / 1_000) * 1_000);
}

function captureSessionEvents() {
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
    audit: new StructuredAuthenticationSessionAudit(logger),
    contexts,
    messages,
  };
}

function noOpSessionAudit(): AuthenticationSessionAudit {
  return {
    recordRefreshSuccess: () => undefined,
    recordRefreshFailure: () => undefined,
    recordRefreshReuse: () => undefined,
  };
}

async function invalidRefreshSignature(task: Promise<unknown>) {
  let signature = '';

  await assert.rejects(task, (error: unknown) => {
    assert.ok(error instanceof InvalidRefreshTokenError);
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

void test('login persiste apenas hash e refresh válido rotaciona sem ampliar a sessão', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:refresh-rotation',
    logger: databaseLogger,
  });
  const accountId = createUuidV7();
  const sessionId = createUuidV7();
  const suffix = createUuidV7().replaceAll('-', '');
  const email = `refresh.${suffix}@example.test`;
  const initialAt = secondPrecision(new Date());
  let currentDate = initialAt;
  const events = captureSessionEvents();

  try {
    await connection.connect();
    const passwordHashes = new Argon2idPasswordHashService();
    await connection.database.insert(accounts).values({
      id: accountId,
      email,
      emailNormalized: normalizeAccountEmail(email),
      passwordHash: await passwordHashes.hash(validPassword),
      type: 'person',
      status: 'active',
      mfaEnabled: false,
    });
    const accountRepository = new DrizzleAccountAuthenticationRepository(
      connection.database
    );
    const sessionRepository = new DrizzleAuthenticationSessionRepository(
      connection.database
    );
    const accessTokens = new JoseAccessTokenService(accessSecret);
    const refreshTokens = new JoseRefreshTokenService(refreshSecret);
    const refreshTokenHashes = new Sha256RefreshTokenHashService();
    const clock = { now: () => currentDate };
    const login = new LoginWithEmailAndPassword(
      new AuthenticateWithEmailAndPassword(
        accountRepository,
        passwordHashes,
        new StructuredAuthenticationAudit({
          info: () => undefined,
          warn: () => undefined,
        }),
        clock
      ),
      accessTokens,
      refreshTokens,
      refreshTokenHashes,
      sessionRepository,
      { generate: () => sessionId },
      clock
    );
    const initial = await login.execute({
      email,
      password: validPassword,
      deviceIdentifier: `browser:${suffix}`,
      deviceName: '  Notebook\nprotegido  ',
      userAgent: ' Browser/1.0\r\n Test ',
    });

    assert.equal(initial.expiresIn, 900);
    assert.equal(initial.refreshExpiresIn, refreshTokenLifetimeSeconds);
    assert.equal(
      (await accessTokens.verify(initial.accessToken, initialAt)).sessionId,
      sessionId
    );
    assert.equal(
      (await refreshTokens.verify(initial.refreshToken, initialAt))?.sessionId,
      sessionId
    );
    const [created] = await connection.database
      .select()
      .from(authSessions)
      .where(eq(authSessions.id, sessionId));
    assert.ok(created);
    assert.equal(created.accountId, accountId);
    assert.equal(
      created.refreshTokenHash,
      refreshTokenHashes.hash(initial.refreshToken)
    );
    assert.equal(
      created.refreshTokenHash.includes(initial.refreshToken),
      false
    );
    assert.equal(created.deviceIdentifier, `browser:${suffix}`);
    assert.equal(created.deviceName, 'Notebook protegido');
    assert.equal(created.userAgent, 'Browser/1.0 Test');
    assert.equal(created.ipHash, null);
    assert.equal(created.lastUsedAt, null);
    assert.equal(created.revokedAt, null);
    assert.equal(created.version, 1);

    currentDate = new Date(initialAt.getTime() + 60_000);
    const refresh = new RefreshAuthenticationSession(
      accessTokens,
      refreshTokens,
      refreshTokenHashes,
      sessionRepository,
      events.audit,
      clock
    );
    const rotated = await refresh.execute({
      refreshToken: initial.refreshToken,
    });
    const [afterRotation] = await connection.database
      .select()
      .from(authSessions)
      .where(eq(authSessions.id, sessionId));

    assert.ok(afterRotation);
    assert.notEqual(rotated.refreshToken, initial.refreshToken);
    assert.equal(
      afterRotation.refreshTokenHash,
      refreshTokenHashes.hash(rotated.refreshToken)
    );
    assert.equal(afterRotation.lastUsedAt?.getTime(), currentDate.getTime());
    assert.equal(
      afterRotation.expiresAt.getTime(),
      created.expiresAt.getTime()
    );
    assert.equal(afterRotation.version, 2);
    assert.equal(
      (await accessTokens.verify(rotated.accessToken, currentDate)).sessionId,
      sessionId
    );
    assert.equal(
      (
        await refreshTokens.verify(rotated.refreshToken, currentDate)
      )?.expiresAt.getTime(),
      created.expiresAt.getTime()
    );

    currentDate = new Date(initialAt.getTime() + 120_000);
    const reusedSignature = await invalidRefreshSignature(
      refresh.execute({ refreshToken: initial.refreshToken })
    );
    const [afterReuse] = await connection.database
      .select()
      .from(authSessions)
      .where(eq(authSessions.id, sessionId));
    assert.equal(afterReuse?.revokedAt?.getTime(), currentDate.getTime());
    assert.equal(afterReuse?.version, 3);

    currentDate = new Date(initialAt.getTime() + 180_000);
    assert.equal(
      await invalidRefreshSignature(
        refresh.execute({ refreshToken: rotated.refreshToken })
      ),
      reusedSignature
    );
    assert.deepEqual(events.contexts, [
      { event: 'authentication.refresh.succeeded' },
      { event: 'authentication.refresh.reuse_detected' },
      { event: 'authentication.refresh.failed' },
    ]);
    assert.doesNotMatch(
      JSON.stringify({ contexts: events.contexts, messages: events.messages }),
      new RegExp(`${initial.refreshToken}|${rotated.refreshToken}`, 'u')
    );
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

void test('duas rotações concorrentes não criam dois sucessores válidos', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:refresh-concurrency',
    logger: databaseLogger,
  });
  const accountId = createUuidV7();
  const sessionId = createUuidV7();
  const suffix = createUuidV7().replaceAll('-', '');
  const initialAt = secondPrecision(new Date());
  const usedAt = new Date(initialAt.getTime() + 60_000);
  const refreshTokens = new JoseRefreshTokenService(refreshSecret);
  const accessTokens = new JoseAccessTokenService(accessSecret);
  const hashes = new Sha256RefreshTokenHashService();
  const issued = await refreshTokens.issue({
    accountId,
    sessionId,
    issuedAt: initialAt,
  });
  const eventNames: string[] = [];
  const audit: AuthenticationSessionAudit = {
    recordRefreshSuccess: () => eventNames.push('success'),
    recordRefreshFailure: () => eventNames.push('failure'),
    recordRefreshReuse: () => eventNames.push('reuse'),
  };

  try {
    await connection.connect();
    const email = `concurrent-refresh.${suffix}@example.test`;
    await connection.database.insert(accounts).values({
      id: accountId,
      email,
      emailNormalized: normalizeAccountEmail(email),
      passwordHash: 'test-only-password-hash',
      type: 'person',
      status: 'active',
      mfaEnabled: false,
    });
    const repository = new DrizzleAuthenticationSessionRepository(
      connection.database
    );
    assert.equal(
      await repository.create({
        id: sessionId,
        accountId,
        refreshTokenHash: hashes.hash(issued.token),
        deviceIdentifier: `concurrent:${suffix}`,
        deviceName: null,
        userAgent: null,
        expiresAt: issued.expiresAt,
        createdAt: initialAt,
      }),
      true
    );
    const refresh = new RefreshAuthenticationSession(
      accessTokens,
      refreshTokens,
      hashes,
      repository,
      audit,
      { now: () => usedAt }
    );
    const attempts = await Promise.allSettled([
      refresh.execute({ refreshToken: issued.token }),
      refresh.execute({ refreshToken: issued.token }),
    ]);

    assert.deepEqual(attempts.map((attempt) => attempt.status).sort(), [
      'fulfilled',
      'rejected',
    ]);
    const winner = attempts.find((attempt) => attempt.status === 'fulfilled');
    assert.ok(winner?.status === 'fulfilled');
    const rejected = attempts.find((attempt) => attempt.status === 'rejected');
    assert.ok(
      rejected?.status === 'rejected' &&
        rejected.reason instanceof InvalidRefreshTokenError
    );
    assert.deepEqual(eventNames.sort(), ['reuse', 'success']);

    const [stored] = await connection.database
      .select()
      .from(authSessions)
      .where(eq(authSessions.id, sessionId));
    assert.equal(stored?.revokedAt?.getTime(), usedAt.getTime());
    assert.equal(stored?.lastUsedAt?.getTime(), usedAt.getTime());
    assert.equal(stored?.version, 3);

    const afterRace = new RefreshAuthenticationSession(
      accessTokens,
      refreshTokens,
      hashes,
      repository,
      noOpSessionAudit(),
      { now: () => new Date(usedAt.getTime() + 1_000) }
    );
    await assert.rejects(
      afterRace.execute({ refreshToken: winner.value.refreshToken }),
      InvalidRefreshTokenError
    );
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

void test('sessões expiradas e revogadas falham com a mesma resposta', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:refresh-inactive',
    logger: databaseLogger,
  });
  const accountId = createUuidV7();
  const sessionIds = [createUuidV7(), createUuidV7()] as const;
  const suffix = createUuidV7().replaceAll('-', '');
  const initialAt = secondPrecision(new Date());
  const refreshTokens = new JoseRefreshTokenService(refreshSecret);
  const accessTokens = new JoseAccessTokenService(accessSecret);
  const hashes = new Sha256RefreshTokenHashService();
  const tokens = await Promise.all(
    sessionIds.map((sessionId) =>
      refreshTokens.issue({ accountId, sessionId, issuedAt: initialAt })
    )
  );

  try {
    await connection.connect();
    const email = `inactive-refresh.${suffix}@example.test`;
    await connection.database.insert(accounts).values({
      id: accountId,
      email,
      emailNormalized: normalizeAccountEmail(email),
      passwordHash: 'test-only-password-hash',
      type: 'person',
      status: 'active',
      mfaEnabled: false,
    });
    const repository = new DrizzleAuthenticationSessionRepository(
      connection.database
    );
    for (const [index, sessionId] of sessionIds.entries()) {
      const token = tokens[index];
      assert.ok(token);
      await repository.create({
        id: sessionId,
        accountId,
        refreshTokenHash: hashes.hash(token.token),
        deviceIdentifier: `inactive:${index}:${suffix}`,
        deviceName: null,
        userAgent: null,
        expiresAt: token.expiresAt,
        createdAt: initialAt,
      });
    }
    const revokedAt = new Date(initialAt.getTime() + 60_000);
    await connection.database
      .update(authSessions)
      .set({
        revokedAt,
        updatedAt: revokedAt,
        version: sql<number>`${authSessions.version} + 1`,
      })
      .where(eq(authSessions.id, sessionIds[1]));

    const expired = new RefreshAuthenticationSession(
      accessTokens,
      refreshTokens,
      hashes,
      repository,
      noOpSessionAudit(),
      { now: () => tokens[0]?.expiresAt ?? initialAt }
    );
    const revoked = new RefreshAuthenticationSession(
      accessTokens,
      refreshTokens,
      hashes,
      repository,
      noOpSessionAudit(),
      { now: () => new Date(initialAt.getTime() + 120_000) }
    );
    const signatures = await Promise.all([
      invalidRefreshSignature(
        expired.execute({ refreshToken: tokens[0]?.token ?? '' })
      ),
      invalidRefreshSignature(
        revoked.execute({ refreshToken: tokens[1]?.token ?? '' })
      ),
    ]);

    assert.equal(new Set(signatures).size, 1);
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
