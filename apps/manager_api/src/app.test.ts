import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import { test } from 'node:test';
import { Pool } from 'pg';
import type { ManagerApiEnvironment } from '@protege-mais/config';
import type {
  AppDatabase,
  DatabaseConnection,
  RedisConnection,
} from '@protege-mais/plugins';
import type { ErrorResponse } from '@protege-mais/schema';
import {
  InvalidCredentialsError,
  InvalidRefreshTokenError,
} from '@protege-mais/use-cases';
import { buildServer, type BuildServerOptions } from './app.js';
import { registerShutdownSignals } from './lifecycle.js';

const testConfiguration: ManagerApiEnvironment = Object.freeze({
  appEnvironment: 'LOCAL',
  host: '127.0.0.1',
  port: 3000,
  corsOrigins: Object.freeze(['http://localhost:5173']),
  databaseUrl: 'postgresql://test:test@127.0.0.1:5432/protege_mais_test',
  jwtAccessSecret: 'test-access-secret-with-at-least-thirty-two-bytes',
  jwtRefreshSecret: 'test-refresh-secret-with-at-least-thirty-two-bytes',
  redisUrl: 'redis://127.0.0.1:6379/0',
  logLevel: 'silent',
});

function createTestRedisConnection(
  isAvailable: () => boolean = () => true,
  onClose: () => void = () => undefined
): RedisConnection {
  const values = new Map<string, string>();

  return {
    namespace: 'protege-mais:local:',
    commands: {
      get: (key) => Promise.resolve(values.get(key) ?? null),
      set: (key, value) => {
        values.set(key, value);
        return Promise.resolve();
      },
      setWithExpiration: (key, value) => {
        values.set(key, value);
        return Promise.resolve();
      },
      delete: (key) => Promise.resolve(values.delete(key) ? 1 : 0),
      expire: (key) => Promise.resolve(values.has(key)),
      incrementWithExpiration: (key) => {
        const value = Number(values.get(key) ?? '0') + 1;
        values.set(key, String(value));
        return Promise.resolve({ value, ttlSeconds: 60 });
      },
    },
    connect: () => Promise.resolve(),
    start: () => undefined,
    isReady: () => Promise.resolve(isAvailable()),
    close: () => {
      onClose();
      return Promise.resolve();
    },
  };
}

function createTestDatabaseConnection(
  isAvailable: () => boolean = () => true,
  onClose: () => void = () => undefined
): DatabaseConnection {
  const pool = new Pool({ allowExitOnIdle: true });
  let closeTask: Promise<void> | undefined;

  return {
    database: Object.create(null) as AppDatabase,
    pool,
    connect: () =>
      isAvailable()
        ? Promise.resolve()
        : Promise.reject(new Error('PostgreSQL de teste indisponível.')),
    start: () => undefined,
    isReady: () => Promise.resolve(isAvailable()),
    close: () => {
      closeTask ??= pool.end().then(onClose);
      return closeTask;
    },
  };
}

function buildTestServer(
  redisConnection = createTestRedisConnection(),
  databaseConnection = createTestDatabaseConnection(),
  options: Omit<
    BuildServerOptions,
    'databaseConnection' | 'redisConnection'
  > = {}
) {
  return buildServer(testConfiguration, {
    ...options,
    redisConnection,
    databaseConnection,
  });
}

function captureLogs() {
  const chunks: string[] = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });

  return {
    destination,
    serialized: () => chunks.join(''),
  };
}

void test('separa liveness e readiness fora do prefixo de negócio', async () => {
  const app = await buildTestServer();

  try {
    const health = await app.inject({ method: 'GET', url: '/health' });
    const ready = await app.inject({ method: 'GET', url: '/ready' });
    const versionedHealth = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    assert.equal(health.statusCode, 200);
    assert.deepEqual(health.json(), { status: 'ok' });
    assert.equal(ready.statusCode, 200);
    assert.deepEqual(ready.json(), { status: 'ok' });
    assert.equal(versionedHealth.statusCode, 404);
    assert.equal(versionedHealth.json<ErrorResponse>().code, 'NOT_FOUND');
  } finally {
    await app.close();
  }
});

void test('responde 503 sanitizado enquanto probe obrigatório está indisponível', async () => {
  const app = await buildTestServer();
  const internalDiagnostic = 'database-secret-diagnostic-prot-006';
  let available = false;

  app.readiness.register({
    name: 'database-test',
    check: () => {
      if (!available) throw new Error(internalDiagnostic);
      return true;
    },
  });

  try {
    const unavailable = await app.inject({
      method: 'GET',
      url: '/ready',
      headers: { 'accept-language': 'en' },
    });
    const health = await app.inject({ method: 'GET', url: '/health' });
    const body = unavailable.json<ErrorResponse>();

    assert.equal(unavailable.statusCode, 503);
    assert.deepEqual(Object.keys(body).sort(), [
      'code',
      'message',
      'requestId',
    ]);
    assert.equal(body.code, 'SERVICE_NOT_READY');
    assert.equal(body.message, 'The service is not ready to receive traffic.');
    assert.notEqual(body.requestId, '');
    assert.doesNotMatch(unavailable.body, new RegExp(internalDiagnostic));
    assert.deepEqual(health.json(), { status: 'ok' });

    available = true;
    const recovered = await app.inject({ method: 'GET', url: '/ready' });
    assert.equal(recovered.statusCode, 200);
    assert.deepEqual(recovered.json(), { status: 'ok' });
  } finally {
    await app.close();
  }
});

void test('identifica Redis indisponível separadamente e reconhece retomada', async () => {
  let redisAvailable = false;
  const app = await buildTestServer(
    createTestRedisConnection(() => redisAvailable)
  );

  try {
    const unavailable = await app.inject({ method: 'GET', url: '/ready' });

    assert.equal(unavailable.statusCode, 503);
    assert.equal(unavailable.json<ErrorResponse>().code, 'SERVICE_NOT_READY');
    assert.deepEqual(await app.redisConnection.isReady(), false);

    redisAvailable = true;
    const recovered = await app.inject({ method: 'GET', url: '/ready' });

    assert.equal(recovered.statusCode, 200);
    assert.deepEqual(recovered.json(), { status: 'ok' });
    assert.deepEqual(await app.redisConnection.isReady(), true);
  } finally {
    await app.close();
  }
});

void test('identifica PostgreSQL indisponível separadamente e reconhece retomada', async () => {
  let databaseAvailable = false;
  const app = await buildTestServer(
    createTestRedisConnection(),
    createTestDatabaseConnection(() => databaseAvailable)
  );

  try {
    const unavailable = await app.inject({ method: 'GET', url: '/ready' });

    assert.equal(unavailable.statusCode, 503);
    assert.equal(unavailable.json<ErrorResponse>().code, 'SERVICE_NOT_READY');
    assert.equal(await app.databaseConnection.isReady(), false);

    databaseAvailable = true;
    const recovered = await app.inject({ method: 'GET', url: '/ready' });

    assert.equal(recovered.statusCode, 200);
    assert.deepEqual(recovered.json(), { status: 'ok' });
    assert.equal(await app.databaseConnection.isReady(), true);
  } finally {
    await app.close();
  }
});

void test('aceita, gera e devolve IDs de correlação seguros', async () => {
  const app = await buildTestServer();

  try {
    const accepted = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        'x-request-id': 'request-manager-prot-008',
        'x-correlation-id': 'correlation-manager-prot-008',
      },
    });
    const generated = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'valor com espaço' },
    });

    assert.equal(accepted.headers['x-request-id'], 'request-manager-prot-008');
    assert.equal(
      accepted.headers['x-correlation-id'],
      'correlation-manager-prot-008'
    );
    assert.match(
      String(generated.headers['x-request-id']),
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
    );
    assert.equal(
      generated.headers['x-correlation-id'],
      generated.headers['x-request-id']
    );
  } finally {
    await app.close();
  }
});

void test('expõe login público, emite somente o contrato aprovado e não registra o token', async () => {
  const loginInputs: unknown[] = [];
  const limitedAddresses: string[] = [];
  const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6ImF0K2p3dCJ9.test.signature';
  const refreshToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6InJ0K2p3dCJ9.test.signature';
  const logs = captureLogs();
  const app = await buildTestServer(
    createTestRedisConnection(),
    createTestDatabaseConnection(),
    {
      logDestination: logs.destination,
      loginRateLimiter: {
        consume: (clientAddress) => {
          limitedAddresses.push(clientAddress);
          return Promise.resolve({
            remainingAttempts: 4,
            retryAfterSeconds: 60,
          });
        },
      },
      loginUseCase: {
        execute: (input) => {
          loginInputs.push(input);
          return Promise.resolve({
            accessToken,
            refreshToken,
            tokenType: 'Bearer',
            expiresIn: 900,
            refreshExpiresIn: 2_592_000,
          });
        },
      },
    }
  );

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'user@example.test',
        password: 'senha integral sem normalização HTTP',
        deviceIdentifier: 'browser:test-device',
        deviceName: 'Navegador de teste',
      },
      headers: { 'user-agent': 'Test Browser/1.0' },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers.pragma, 'no-cache');
    assert.deepEqual(response.json(), {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshExpiresIn: 2_592_000,
    });
    assert.deepEqual(loginInputs, [
      {
        email: 'user@example.test',
        password: 'senha integral sem normalização HTTP',
        deviceIdentifier: 'browser:test-device',
        deviceName: 'Navegador de teste',
        userAgent: 'Test Browser/1.0',
      },
    ]);
    assert.equal(limitedAddresses.length, 1);
    assert.notEqual(limitedAddresses[0], '');
  } finally {
    await app.close();
  }

  assert.doesNotMatch(logs.serialized(), new RegExp(accessToken));
  assert.doesNotMatch(logs.serialized(), new RegExp(refreshToken));
  assert.doesNotMatch(logs.serialized(), /user@example\.test|senha integral/u);
});

void test('rejeita body estruturalmente inválido antes do rate limit e do caso de uso', async () => {
  let limitCalls = 0;
  let loginCalls = 0;
  const app = await buildTestServer(
    createTestRedisConnection(),
    createTestDatabaseConnection(),
    {
      loginRateLimiter: {
        consume: () => {
          limitCalls += 1;
          return Promise.resolve({
            remainingAttempts: 4,
            retryAfterSeconds: 60,
          });
        },
      },
      loginUseCase: {
        execute: () => {
          loginCalls += 1;
          return Promise.resolve({
            accessToken: 'unused',
            refreshToken: 'unused-refresh',
            tokenType: 'Bearer',
            expiresIn: 900,
            refreshExpiresIn: 2_592_000,
          });
        },
      },
    }
  );

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'user@example.test',
      },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json<ErrorResponse>().code, 'VALIDATION_ERROR');
    assert.equal(limitCalls, 0);
    assert.equal(loginCalls, 0);
  } finally {
    await app.close();
  }
});

void test('rotaciona refresh em rota pública sem registrar nenhuma credencial', async () => {
  const presentedToken = 'presented-refresh-token-private-prot-024';
  const successorToken = 'successor-refresh-token-private-prot-024';
  const accessToken = 'successor-access-token-private-prot-024';
  const inputs: unknown[] = [];
  const logs = captureLogs();
  const app = await buildTestServer(
    createTestRedisConnection(),
    createTestDatabaseConnection(),
    {
      logDestination: logs.destination,
      refreshUseCase: {
        execute: (input) => {
          inputs.push(input);
          return Promise.resolve({
            accessToken,
            refreshToken: successorToken,
            tokenType: 'Bearer',
            expiresIn: 900,
            refreshExpiresIn: 2_505_600,
          });
        },
      },
    }
  );

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: presentedToken },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers.pragma, 'no-cache');
    assert.deepEqual(response.json(), {
      accessToken,
      refreshToken: successorToken,
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshExpiresIn: 2_505_600,
    });
    assert.deepEqual(inputs, [{ refreshToken: presentedToken }]);
  } finally {
    await app.close();
  }

  assert.doesNotMatch(
    logs.serialized(),
    /presented-refresh-token|successor-refresh-token|successor-access-token/u
  );
});

void test('refresh inválido usa erro uniforme e traduzido sem enumerar sessão', async () => {
  const app = await buildTestServer(
    createTestRedisConnection(),
    createTestDatabaseConnection(),
    {
      refreshUseCase: {
        execute: () => Promise.reject(new InvalidRefreshTokenError()),
      },
    }
  );

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { 'accept-language': 'en' },
      payload: { refreshToken: 'invalid-refresh-token' },
    });
    const body = response.json<ErrorResponse>();

    assert.equal(response.statusCode, 401);
    assert.equal(body.code, 'INVALID_REFRESH_TOKEN');
    assert.equal(body.message, 'Invalid refresh token.');
    assert.deepEqual(Object.keys(body).sort(), [
      'code',
      'message',
      'requestId',
    ]);
  } finally {
    await app.close();
  }
});

void test('aplica rate limit distribuído sem diferenciar credenciais inválidas', async () => {
  const app = await buildTestServer(
    createTestRedisConnection(),
    createTestDatabaseConnection(),
    {
      loginUseCase: {
        execute: () => Promise.reject(new InvalidCredentialsError()),
      },
    }
  );
  const invalidResponses: ErrorResponse[] = [];

  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'accept-language': 'en' },
        payload: {
          email:
            attempt % 2 === 0 ? 'missing@example.test' : 'blocked@example.test',
          password: 'invalid credential attempt',
          deviceIdentifier: 'browser:invalid-attempt',
        },
      });

      assert.equal(response.statusCode, 401);
      invalidResponses.push(response.json<ErrorResponse>());
    }

    assert.equal(
      new Set(invalidResponses.map(({ code, message }) => `${code}:${message}`))
        .size,
      1
    );
    assert.equal(invalidResponses[0]?.code, 'INVALID_CREDENTIALS');

    const limited = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'accept-language': 'en' },
      payload: {
        email: 'another@example.test',
        password: 'invalid credential attempt',
        deviceIdentifier: 'browser:limited-attempt',
      },
    });
    const body = limited.json<ErrorResponse>();

    assert.equal(limited.statusCode, 429);
    assert.equal(limited.headers['retry-after'], '60');
    assert.equal(body.code, 'AUTHENTICATION_RATE_LIMITED');
    assert.equal(
      body.message,
      'Too many authentication attempts were made. Try again later.'
    );
    assert.deepEqual(Object.keys(body).sort(), [
      'code',
      'message',
      'requestId',
    ]);
  } finally {
    await app.close();
  }
});

void test('falha fechada e sanitizada quando o contador de login está indisponível', async () => {
  const readyRedis = createTestRedisConnection();
  const unavailableRedis: RedisConnection = {
    ...readyRedis,
    commands: {
      ...readyRedis.commands,
      incrementWithExpiration: () =>
        Promise.reject(new Error('redis-private-diagnostic')),
    },
  };
  let loginCalls = 0;
  const app = await buildTestServer(
    unavailableRedis,
    createTestDatabaseConnection(),
    {
      loginUseCase: {
        execute: () => {
          loginCalls += 1;
          return Promise.resolve({
            accessToken: 'unused',
            refreshToken: 'unused-refresh',
            tokenType: 'Bearer',
            expiresIn: 900,
            refreshExpiresIn: 2_592_000,
          });
        },
      },
    }
  );

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'accept-language': 'es' },
      payload: {
        email: 'user@example.test',
        password: 'credential attempt',
        deviceIdentifier: 'browser:unavailable-attempt',
      },
    });
    const body = response.json<ErrorResponse>();

    assert.equal(response.statusCode, 503);
    assert.equal(body.code, 'AUTHENTICATION_UNAVAILABLE');
    assert.equal(
      body.message,
      'La autenticación no está disponible temporalmente.'
    );
    assert.doesNotMatch(response.body, /redis-private-diagnostic/u);
    assert.equal(loginCalls, 0);
  } finally {
    await app.close();
  }
});

void test('SIGTERM encerra o listener, o pool e o estado de readiness uma vez', async () => {
  let redisCloses = 0;
  let databaseCloses = 0;
  const app = await buildTestServer(
    createTestRedisConnection(
      () => true,
      () => {
        redisCloses += 1;
      }
    ),
    createTestDatabaseConnection(
      () => true,
      () => {
        databaseCloses += 1;
      }
    )
  );
  const signalSource = new EventEmitter();
  let closeHooks = 0;
  let shutdownError: unknown;

  app.addHook('onClose', () => {
    closeHooks += 1;
  });

  const signals = registerShutdownSignals(
    app,
    (error) => {
      shutdownError = error;
    },
    signalSource
  );

  try {
    await app.listen({ host: '127.0.0.1', port: 0 });

    assert.equal(app.server.listening, true);
    assert.equal(app.dbPool.ended, false);

    signalSource.emit('SIGTERM');
    const firstShutdown = signals.shutdown();
    const repeatedShutdown = signals.shutdown();

    assert.equal(firstShutdown, repeatedShutdown);
    assert.equal(await app.readiness.isReady(), false);

    await firstShutdown;

    assert.equal(shutdownError, undefined);
    assert.equal(app.server.listening, false);
    assert.equal(app.dbPool.ended, true);
    assert.equal(redisCloses, 1);
    assert.equal(databaseCloses, 1);
    assert.equal(closeHooks, 1);
    assert.equal(signalSource.listenerCount('SIGINT'), 0);
    assert.equal(signalSource.listenerCount('SIGTERM'), 0);
  } finally {
    signals.remove();
    if (app.server.listening) await app.close();
  }
});
