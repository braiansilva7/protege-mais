import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import type { ManagerApiEnvironment } from '@protege-mais/config';
import type { ErrorResponse } from '@protege-mais/schema';
import { buildServer } from './app.js';
import { registerShutdownSignals } from './lifecycle.js';

const testConfiguration: ManagerApiEnvironment = Object.freeze({
  appEnvironment: 'LOCAL',
  host: '127.0.0.1',
  port: 3000,
  corsOrigins: Object.freeze(['http://localhost:5173']),
  databaseUrl: 'postgresql://test:test@127.0.0.1:5432/protege_mais_test',
  logLevel: 'silent',
});

void test('separa liveness e readiness fora do prefixo de negócio', async () => {
  const app = await buildServer(testConfiguration);

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
  const app = await buildServer(testConfiguration);
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

void test('aceita, gera e devolve IDs de correlação seguros', async () => {
  const app = await buildServer(testConfiguration);

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

void test('SIGTERM encerra o listener, o pool e o estado de readiness uma vez', async () => {
  const app = await buildServer(testConfiguration);
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
    assert.equal(closeHooks, 1);
    assert.equal(signalSource.listenerCount('SIGINT'), 0);
    assert.equal(signalSource.listenerCount('SIGTERM'), 0);
  } finally {
    signals.remove();
    if (app.server.listening) await app.close();
  }
});
