import assert from 'node:assert/strict';
import { connect, createServer, type Server, type Socket } from 'node:net';
import { test } from 'node:test';
import { databaseEnvironment } from '@protege-mais/config';
import { sql } from 'drizzle-orm';
import { createDatabaseConnection, type DatabaseLogger } from './index.js';

const logger: DatabaseLogger = {
  info: () => undefined,
  warn: () => undefined,
};

async function waitUntil(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 10_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (!(await predicate())) {
    if (Date.now() >= deadline) {
      throw new Error(
        'A condição PostgreSQL não foi atendida dentro do timeout.'
      );
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

async function createPostgresProxy(targetUrl: URL) {
  const sockets = new Set<Socket>();
  const server = createServer((downstream) => {
    const upstream = connect({
      host: targetUrl.hostname,
      port: Number(targetUrl.port || 5432),
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
    upstream.once('error', () => upstream.destroy());
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('O proxy PostgreSQL não recebeu uma porta TCP.');
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

void test('PostgreSQL real conecta, executa Drizzle em UTC e fecha o pool', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:database-integration',
    logger,
  });

  try {
    await connection.connect();
    assert.equal(await connection.isReady(), true);

    const result = await connection.database.execute<{
      readonly serverTimestamp: string;
      readonly sessionTimeZone: string;
    }>(sql`
      SELECT
        CURRENT_TIMESTAMP::text AS "serverTimestamp",
        current_setting('TIMEZONE') AS "sessionTimeZone"
    `);

    assert.equal(result.rowCount, 1);
    assert.equal(result.rows[0]?.sessionTimeZone, 'UTC');
    assert.match(
      result.rows[0]?.serverTimestamp ?? '',
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?\+00$/u
    );
    assert.ok(connection.pool.totalCount >= 1);
  } finally {
    const firstClose = connection.close();
    const repeatedClose = connection.close();
    assert.equal(firstClose, repeatedClose);
    await firstClose;
    assert.equal(connection.pool.ended, true);
  }
});

void test('PostGIS real expõe versão, SRID 4326 e distância geodésica', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:postgis-integration',
    logger,
  });

  try {
    await connection.connect();

    const result = await connection.database.execute<{
      readonly distanceMeters: number;
      readonly extensionVersion: string;
      readonly libraryVersion: string;
      readonly srid: number;
    }>(sql`
      SELECT
        ST_Distance(
          ST_SetSRID(ST_MakePoint(0, 0), 4326)::geography,
          ST_SetSRID(ST_MakePoint(1, 0), 4326)::geography
        ) AS "distanceMeters",
        extension.extversion AS "extensionVersion",
        PostGIS_Lib_Version() AS "libraryVersion",
        ST_SRID(ST_SetSRID(ST_MakePoint(0, 0), 4326)) AS "srid"
      FROM pg_extension AS extension
      WHERE extension.extname = 'postgis'
    `);

    assert.equal(result.rowCount, 1);
    assert.match(result.rows[0]?.extensionVersion ?? '', /^\d+\.\d+/u);
    assert.match(result.rows[0]?.libraryVersion ?? '', /^\d+\.\d+/u);
    assert.equal(result.rows[0]?.srid, 4326);
    assert.ok(
      Math.abs((result.rows[0]?.distanceMeters ?? 0) - 111_319.490_793) < 0.01
    );
  } finally {
    await connection.close();
  }
});

void test('PostgreSQL real fecha readiness e retoma por um novo socket', async () => {
  const configuration = databaseEnvironment();
  const targetUrl = new URL(configuration.databaseUrl);
  const proxy = await createPostgresProxy(targetUrl);
  const proxyUrl = new URL(configuration.databaseUrl);
  proxyUrl.hostname = '127.0.0.1';
  proxyUrl.port = String(proxy.port);
  const connection = createDatabaseConnection({
    databaseUrl: proxyUrl.toString(),
    applicationName: 'protege-mais:database-recovery',
    logger,
  });

  try {
    connection.start();
    await waitUntil(() => connection.isReady());
    assert.equal(await connection.isReady(), true);

    await proxy.stop();
    await waitUntil(async () => !(await connection.isReady()));

    await proxy.start();
    await waitUntil(() => connection.isReady());
    assert.equal(await connection.isReady(), true);
  } finally {
    await connection.close();
    await proxy.stop();
  }
});
