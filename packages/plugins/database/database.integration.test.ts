import assert from 'node:assert/strict';
import { connect, createServer, type Server, type Socket } from 'node:net';
import { test } from 'node:test';
import { fundamentalEnumCatalog } from '@protege-mais/common';
import { databaseEnvironment } from '@protege-mais/config';
import { sql } from 'drizzle-orm';
import { createDatabaseConnection, type DatabaseLogger } from './index.js';

const logger: DatabaseLogger = {
  info: () => undefined,
  warn: () => undefined,
};

void test('PostgreSQL mantém paridade dos enums e rejeita inserts inválidos', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:enum-integration',
    logger,
  });

  try {
    await connection.connect();

    const catalogResult = await connection.database.execute<{
      readonly databaseName: string;
      readonly enumValue: string;
    }>(sql`
      SELECT
        enum_type.typname AS "databaseName",
        enum_value.enumlabel AS "enumValue"
      FROM pg_type AS enum_type
      INNER JOIN pg_namespace AS enum_namespace
        ON enum_namespace.oid = enum_type.typnamespace
      INNER JOIN pg_enum AS enum_value
        ON enum_value.enumtypid = enum_type.oid
      WHERE enum_namespace.nspname = 'public'
      ORDER BY enum_type.typname, enum_value.enumsortorder
    `);
    const actualValues = new Map<string, string[]>();
    for (const row of catalogResult.rows) {
      const values = actualValues.get(row.databaseName) ?? [];
      values.push(row.enumValue);
      actualValues.set(row.databaseName, values);
    }

    assert.deepEqual(
      [...actualValues.keys()],
      Object.values(fundamentalEnumCatalog)
        .map((definition) => definition.databaseName)
        .sort()
    );
    for (const definition of Object.values(fundamentalEnumCatalog)) {
      assert.deepEqual(
        actualValues.get(definition.databaseName),
        definition.values
      );
    }

    const client = await connection.pool.connect();
    const definitions = Object.values(fundamentalEnumCatalog);
    const columnNames = definitions.map(
      (definition) => `"${definition.databaseName}"`
    );
    const createColumns = definitions.map(
      (definition) =>
        `"${definition.databaseName}" "${definition.databaseName}" NOT NULL`
    );
    const placeholders = definitions.map((_, index) => `$${index + 1}`);
    const insertStatement = `
      INSERT INTO prot_014_enum_validation (${columnNames.join(', ')})
      VALUES (${placeholders.join(', ')})
    `;
    const validValues: string[] = definitions.map(
      (definition) => definition.values[0]
    );

    try {
      await client.query('BEGIN');
      await client.query(`
        CREATE TEMP TABLE prot_014_enum_validation (
          ${createColumns.join(',\n')}
        ) ON COMMIT DROP
      `);
      await client.query(insertStatement, validValues);

      for (const [index] of definitions.entries()) {
        const savepoint = `invalid_enum_${index}`;
        const invalidValues = [...validValues];
        invalidValues[index] = 'invalid_value';

        await client.query(`SAVEPOINT ${savepoint}`);
        await assert.rejects(
          client.query(insertStatement, invalidValues),
          (error: unknown) =>
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === '22P02'
        );
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      }
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  } finally {
    await connection.close();
  }
});

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
