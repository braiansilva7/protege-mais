import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import { Pool } from 'pg';
import { registerReadiness } from '../readiness/index.js';
import {
  createDatabaseConnection,
  databaseConnectionTimeoutMs,
  databaseDefaultMaximumPoolSize,
  databaseIdleTimeoutMs,
  databaseQueryTimeoutMs,
  registerDatabase,
  type AppDatabase,
  type DatabaseConnection,
  type DatabaseLogger,
} from './index.js';

void test('configura pool limitado, timeouts e sessões PostgreSQL em UTC', async () => {
  const connection = createDatabaseConnection({
    databaseUrl: 'postgresql://test:test@127.0.0.1:1/protege_mais_test',
    applicationName: 'protege-mais:test',
    logger: {
      info: () => undefined,
      warn: () => undefined,
    },
  });

  try {
    assert.equal(connection.pool.options.max, databaseDefaultMaximumPoolSize);
    assert.equal(
      connection.pool.options.connectionTimeoutMillis,
      databaseConnectionTimeoutMs
    );
    assert.equal(
      connection.pool.options.idleTimeoutMillis,
      databaseIdleTimeoutMs
    );
    assert.equal(connection.pool.options.query_timeout, databaseQueryTimeoutMs);
    assert.equal(
      connection.pool.options.statement_timeout,
      databaseQueryTimeoutMs
    );
    assert.equal(connection.pool.options.options, '-c timezone=UTC');
    assert.equal(connection.pool.options.application_name, 'protege-mais:test');
  } finally {
    await connection.close();
  }
});

void test('rejeita configuração do pool fora dos limites sem revelar URL', () => {
  const databaseUrl =
    'postgresql://user:database-secret-prot-011@127.0.0.1:5432/app';
  const logger: DatabaseLogger = {
    info: () => undefined,
    warn: () => undefined,
  };

  for (const maximumPoolSize of [0, 101, 1.5]) {
    assert.throws(
      () =>
        createDatabaseConnection({
          databaseUrl,
          applicationName: 'protege-mais:test',
          maximumPoolSize,
          logger,
        }),
      (error: unknown) => {
        assert.ok(error instanceof RangeError);
        assert.doesNotMatch(error.message, /database-secret-prot-011/u);
        return true;
      }
    );
  }

  assert.throws(
    () =>
      createDatabaseConnection({
        databaseUrl,
        applicationName: 'nome com espaço',
        logger,
      }),
    RangeError
  );
});

void test('plugin registra Drizzle, probe e fechamento idempotente', async () => {
  const pool = new Pool({ allowExitOnIdle: true });
  const database = Object.create(null) as AppDatabase;
  let available = false;
  let starts = 0;
  let closes = 0;
  let closeTask: Promise<void> | undefined;
  const connection: DatabaseConnection = {
    database,
    pool,
    connect: () => Promise.resolve(),
    start: () => {
      starts += 1;
    },
    isReady: () => Promise.resolve(available),
    close: () => {
      closeTask ??= pool.end().then(() => {
        closes += 1;
      });
      return closeTask;
    },
  };
  const server = Fastify({ logger: false });

  await server.register(registerReadiness);
  await server.register(registerDatabase, {
    databaseUrl: 'postgresql://ignored:ignored@127.0.0.1:1/ignored',
    applicationName: 'protege-mais:test',
    connection,
  });
  await server.ready();

  assert.equal(starts, 1);
  assert.equal(server.DatabaseRw, database);
  assert.equal(server.DatabaseRo, database);
  assert.equal(server.dbPool, pool);
  assert.equal(server.databaseConnection, connection);
  assert.equal(await server.readiness.isReady(), false);

  available = true;
  assert.equal(await server.readiness.isReady(), true);

  await server.close();
  await server.close();
  assert.equal(closes, 1);
});

void test('conexão inválida falha com logs sem credenciais e fecha uma vez', async () => {
  const password = 'database-secret-prot-011';
  const records: unknown[] = [];
  const logger: DatabaseLogger = {
    info: (context, message) => records.push({ context, message }),
    warn: (context, message) => records.push({ context, message }),
  };
  const connection = createDatabaseConnection({
    databaseUrl: `postgresql://user:${password}@127.0.0.1:1/protege_mais`,
    applicationName: 'protege-mais:test',
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
  assert.doesNotMatch(serializedRecords, /DATABASE_URL|postgres(?:ql)?:\/\//u);
  assert.match(serializedRecords, /database\.connection\.unavailable/u);
  assert.match(serializedRecords, /database\.connection\.closed/u);
});
