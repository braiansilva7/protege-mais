import assert from 'node:assert/strict';
import { connect, createServer, type Server, type Socket } from 'node:net';
import { test } from 'node:test';
import { redisEnvironment } from '@protege-mais/config';
import { createClient } from 'redis';
import {
  createRedisConnection,
  redisCommandTimeoutMs,
  redisConnectTimeoutMs,
  type RedisLogger,
} from './index.js';

const logger: RedisLogger = {
  info: () => undefined,
  warn: () => undefined,
};

async function waitUntil(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 8_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (!(await predicate())) {
    if (Date.now() >= deadline) {
      throw new Error('A condição Redis não foi atendida dentro do timeout.');
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function createRedisProxy(targetUrl: URL) {
  const sockets = new Set<Socket>();
  const server = createServer((downstream) => {
    const upstream = connect({
      host: targetUrl.hostname,
      port: Number(targetUrl.port || 6379),
    });

    sockets.add(downstream);
    sockets.add(upstream);
    downstream.pipe(upstream);
    upstream.pipe(downstream);

    const forget = () => {
      sockets.delete(downstream);
      sockets.delete(upstream);
    };
    downstream.once('close', forget);
    upstream.once('close', forget);
    downstream.once('error', () => downstream.destroy());
    upstream.once('error', () => downstream.destroy());
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('O proxy Redis não recebeu uma porta TCP.');
  }
  const port = address.port;

  return {
    port,
    stop: async () => {
      for (const socket of sockets) socket.destroy();
      if (server.listening) await closeServer(server);
    },
    start: async () => {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', resolve);
      });
    },
  };
}

void test('Redis real aplica namespace, set/get e expiração', async () => {
  const configuration = redisEnvironment();
  const connection = createRedisConnection({
    redisUrl: configuration.redisUrl,
    environment: configuration.appEnvironment,
    logger,
  });
  const observer = createClient({
    url: configuration.redisUrl,
    disableOfflineQueue: true,
    commandOptions: { timeout: redisCommandTimeoutMs },
    socket: {
      connectTimeout: redisConnectTimeoutMs,
      reconnectStrategy: false,
    },
  });
  observer.on('error', () => undefined);
  const key = `integration:ttl:${Date.now()}`;

  try {
    connection.start();
    await waitUntil(() => connection.isReady());
    await observer.connect();

    await connection.commands.set(key, 'available');
    assert.equal(await connection.commands.get(key), 'available');
    assert.equal(
      await observer.get(`${connection.namespace}${key}`),
      'available'
    );
    assert.equal(await observer.get(key), null);

    await connection.commands.setWithExpiration(key, 'temporary', 1);
    assert.equal(await connection.commands.get(key), 'temporary');
    await waitUntil(async () => (await connection.commands.get(key)) === null);

    const rateLimitKey = `integration:counter:${Date.now()}`;
    const firstIncrement = await connection.commands.incrementWithExpiration(
      rateLimitKey,
      5
    );
    const secondIncrement = await connection.commands.incrementWithExpiration(
      rateLimitKey,
      5
    );
    assert.equal(firstIncrement.value, 1);
    assert.ok(firstIncrement.ttlSeconds >= 4);
    assert.ok(firstIncrement.ttlSeconds <= 5);
    assert.equal(secondIncrement.value, 2);
    assert.ok(secondIncrement.ttlSeconds >= 1);
    assert.ok(secondIncrement.ttlSeconds <= 5);
    assert.equal(
      await observer.get(`${connection.namespace}${rateLimitKey}`),
      '2'
    );
    await connection.commands.delete(rateLimitKey);
  } finally {
    if (observer.isOpen) await observer.close();
    await connection.close();
  }
});

void test('Redis real detecta indisponibilidade e retoma após reconexão', async () => {
  const configuration = redisEnvironment();
  const targetUrl = new URL(configuration.redisUrl);
  const proxy = await createRedisProxy(targetUrl);
  const proxyUrl = new URL(configuration.redisUrl);
  proxyUrl.hostname = '127.0.0.1';
  proxyUrl.port = String(proxy.port);
  const connection = createRedisConnection({
    redisUrl: proxyUrl.toString(),
    environment: configuration.appEnvironment,
    logger,
  });
  const key = `integration:reconnect:${Date.now()}`;

  try {
    connection.start();
    await waitUntil(() => connection.isReady());
    assert.equal(await connection.isReady(), true);
    await connection.commands.set(key, 'before');

    await proxy.stop();
    await waitUntil(async () => !(await connection.isReady()));

    await proxy.start();
    await waitUntil(() => connection.isReady());
    await connection.commands.set(key, 'after');
    assert.equal(await connection.commands.get(key), 'after');
    await connection.commands.delete(key);
  } finally {
    await proxy.stop();
    await connection.close();
  }
});
