import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import { registerReadiness } from '../readiness/index.js';
import {
  createRedisConnection,
  redisKeyNamespace,
  redisMaximumReconnectDelayMs,
  redisReconnectDelay,
  registerRedis,
  type RedisConnection,
  type RedisLogger,
} from './index.js';

void test('gera namespace estável e exclusivo por ambiente', () => {
  assert.equal(redisKeyNamespace('LOCAL'), 'protege-mais:local:');
  assert.equal(redisKeyNamespace('dev'), 'protege-mais:dev:');
  assert.equal(redisKeyNamespace(' HMG '), 'protege-mais:hmg:');
  assert.equal(redisKeyNamespace('PROD'), 'protege-mais:prod:');
  assert.throws(() => redisKeyNamespace('qa'), RangeError);
});

void test('limita o backoff de reconexão e adiciona jitter curto', () => {
  for (const retries of [0, 1, 5, 50]) {
    const delay = redisReconnectDelay(retries);
    assert.ok(delay >= 50);
    assert.ok(delay <= redisMaximumReconnectDelayMs);
  }
});

void test('rejeita chave e TTL inválidos antes de executar comandos', async () => {
  const connection = createRedisConnection({
    redisUrl: 'redis://127.0.0.1:6379/0',
    environment: 'LOCAL',
    logger: {
      info: () => undefined,
      warn: () => undefined,
    },
  });

  await assert.rejects(() => connection.commands.get(''), RangeError);
  await assert.rejects(
    () => connection.commands.set(' key-with-spaces ', 'value'),
    RangeError
  );
  await assert.rejects(
    () => connection.commands.setWithExpiration('cache:item', 'value', 0),
    RangeError
  );
  await assert.rejects(
    () => connection.commands.incrementWithExpiration('rate-limit:item', 0),
    RangeError
  );
  await connection.close();
});

void test('plugin registra comandos, probe e fechamento Redis', async () => {
  let available = false;
  let starts = 0;
  let closes = 0;
  const values = new Map<string, string>();
  const connection: RedisConnection = {
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
    start: () => {
      starts += 1;
    },
    isReady: () => Promise.resolve(available),
    close: () => {
      closes += 1;
      return Promise.resolve();
    },
  };
  const server = Fastify({ logger: false });

  await server.register(registerReadiness);
  await server.register(registerRedis, {
    redisUrl: 'redis://credential-that-must-not-appear@127.0.0.1:6379/0',
    environment: 'LOCAL',
    connection,
  });
  await server.ready();

  assert.equal(starts, 1);
  assert.equal(await server.readiness.isReady(), false);

  available = true;
  assert.equal(await server.readiness.isReady(), true);
  await server.redis.set('cache:item', 'value');
  assert.equal(await server.redis.get('cache:item'), 'value');

  await server.close();
  await server.close();
  assert.equal(closes, 1);
});

void test('indisponibilidade não vaza REDIS_URL nos eventos', async () => {
  const password = 'redis-secret-prot-009';
  const redisUrl = `redis://default:${password}@127.0.0.1:1/0`;
  const records: Readonly<Record<string, unknown>>[] = [];
  const logger: RedisLogger = {
    info: (context) => records.push(context),
    warn: (context) => records.push(context),
  };
  const connection = createRedisConnection({
    redisUrl,
    environment: 'LOCAL',
    logger,
  });

  connection.start();
  await new Promise((resolve) => setTimeout(resolve, 75));

  assert.equal(await connection.isReady(), false);
  const firstClose = connection.close();
  const repeatedClose = connection.close();
  assert.equal(firstClose, repeatedClose);
  await firstClose;

  const serializedRecords = JSON.stringify(records);
  assert.doesNotMatch(serializedRecords, new RegExp(password));
  assert.doesNotMatch(serializedRecords, /REDIS_URL|redis:\/\//u);
  assert.match(serializedRecords, /redis\.connection\.(?:error|reconnecting)/u);
});
