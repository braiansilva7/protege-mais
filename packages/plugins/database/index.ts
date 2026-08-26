import 'reflect-metadata';
import fp from 'fastify-plugin';
import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { container } from 'tsyringe';
import type { FastifyInstance } from 'fastify';
import * as schema from '@protege-mais/models';
import type { ReadinessRegistry } from '../readiness/index.js';

export const databaseConnectionTimeoutMs = 2_000;
export const databaseIdleTimeoutMs = 30_000;
export const databaseQueryTimeoutMs = 5_000;
export const databaseDefaultMaximumPoolSize = 10;

export type AppDatabase = NodePgDatabase<typeof schema>;

export interface DatabaseLogger {
  info(context: Readonly<Record<string, unknown>>, message: string): unknown;
  warn(context: Readonly<Record<string, unknown>>, message: string): unknown;
}

export interface DatabaseConnection {
  readonly database: AppDatabase;
  readonly pool: Pool;
  connect(): Promise<void>;
  start(): void;
  isReady(): Promise<boolean>;
  close(): Promise<void>;
}

export interface DatabaseConnectionOptions {
  readonly databaseUrl: string;
  readonly applicationName: string;
  readonly logger: DatabaseLogger;
  readonly maximumPoolSize?: number;
}

export interface DatabasePluginOptions {
  readonly databaseUrl: string;
  readonly applicationName: string;
  readonly maximumPoolSize?: number;
  readonly connection?: DatabaseConnection;
}

function normalizedApplicationName(value: string): string {
  const applicationName = value.trim();

  if (!/^[a-z0-9][a-z0-9:._-]{0,62}$/iu.test(applicationName)) {
    throw new RangeError('O nome da aplicação PostgreSQL é inválido.');
  }

  return applicationName;
}

function normalizedMaximumPoolSize(value: number | undefined): number {
  const maximumPoolSize = value ?? databaseDefaultMaximumPoolSize;

  if (
    !Number.isSafeInteger(maximumPoolSize) ||
    maximumPoolSize < 1 ||
    maximumPoolSize > 100
  ) {
    throw new RangeError('O tamanho máximo do pool PostgreSQL é inválido.');
  }

  return maximumPoolSize;
}

function safeDatabaseErrorType(value: unknown): string {
  try {
    if (
      value instanceof Error &&
      /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u.test(value.name)
    ) {
      return value.name;
    }
  } catch {
    // O tipo sintético abaixo evita consultar novamente o erro hostil.
  }

  return 'Error';
}

class ManagedDatabaseConnection implements DatabaseConnection {
  readonly #logger: DatabaseLogger;
  #startTask: Promise<void> | undefined;
  #closeTask: Promise<void> | undefined;
  #closing = false;

  public readonly database: AppDatabase;
  public readonly pool: Pool;

  constructor(options: DatabaseConnectionOptions) {
    this.#logger = options.logger;
    this.pool = new Pool({
      connectionString: options.databaseUrl,
      application_name: normalizedApplicationName(options.applicationName),
      max: normalizedMaximumPoolSize(options.maximumPoolSize),
      min: 0,
      connectionTimeoutMillis: databaseConnectionTimeoutMs,
      idleTimeoutMillis: databaseIdleTimeoutMs,
      statement_timeout: databaseQueryTimeoutMs,
      query_timeout: databaseQueryTimeoutMs,
      idle_in_transaction_session_timeout: databaseQueryTimeoutMs,
      options: '-c timezone=UTC',
    });
    this.database = drizzle(this.pool, { schema });

    this.pool.on('error', (error: Error) => {
      this.#logger.warn(
        {
          event: 'database.pool.error',
          errorType: safeDatabaseErrorType(error),
        },
        'Falha segura em uma conexão PostgreSQL ociosa.'
      );
    });
  }

  public async connect(): Promise<void> {
    if (this.#closing || this.pool.ended) {
      throw new Error('A conexão PostgreSQL está encerrando.');
    }

    const result = await this.pool.query<{ readonly ready: number }>(
      'SELECT 1::integer AS ready'
    );

    if (result.rowCount !== 1 || result.rows[0]?.ready !== 1) {
      throw new Error('A verificação PostgreSQL retornou resultado inválido.');
    }
  }

  public start(): void {
    this.#startTask ??= this.connect().then(
      () => {
        this.#logger.info(
          { event: 'database.connection.ready' },
          'Conexão PostgreSQL pronta.'
        );
      },
      (error: unknown) => {
        this.#logger.warn(
          {
            event: 'database.connection.unavailable',
            errorType: safeDatabaseErrorType(error),
          },
          'PostgreSQL indisponível; readiness permanecerá fechada.'
        );
      }
    );
  }

  public async isReady(): Promise<boolean> {
    if (this.#closing || this.pool.ended) return false;

    try {
      await this.connect();
      return true;
    } catch {
      return false;
    }
  }

  public close(): Promise<void> {
    this.#closeTask ??= this.#close();
    return this.#closeTask;
  }

  async #close(): Promise<void> {
    this.#closing = true;
    await this.pool.end();
    await this.#startTask;
    this.#logger.info(
      { event: 'database.connection.closed' },
      'Conexão PostgreSQL encerrada.'
    );
  }
}

export function createDatabaseConnection(
  options: DatabaseConnectionOptions
): DatabaseConnection {
  return new ManagedDatabaseConnection(options);
}

declare module 'fastify' {
  interface FastifyInstance {
    readiness: ReadinessRegistry;
    DatabaseRw: AppDatabase;
    DatabaseRo: AppDatabase;
    dbPool: Pool;
    databaseConnection: DatabaseConnection;
  }
}

function databasePlugin(
  fastify: FastifyInstance,
  options: DatabasePluginOptions
) {
  const connection =
    options.connection ??
    createDatabaseConnection({
      databaseUrl: options.databaseUrl,
      applicationName: options.applicationName,
      maximumPoolSize: options.maximumPoolSize,
      logger: fastify.log,
    });

  container.register<AppDatabase>('DatabaseRw', {
    useValue: connection.database,
  });
  container.register<AppDatabase>('DatabaseRo', {
    useValue: connection.database,
  });

  fastify.decorate('DatabaseRw', connection.database);
  fastify.decorate('DatabaseRo', connection.database);
  fastify.decorate('dbPool', connection.pool);
  fastify.decorate('databaseConnection', connection);
  fastify.readiness.register({
    name: 'postgresql',
    check: () => connection.isReady(),
  });
  fastify.addHook('onClose', async () => {
    await connection.close();
  });

  connection.start();
}

export const registerDatabase = fp<DatabasePluginOptions>(databasePlugin, {
  name: 'database',
  dependencies: ['readiness'],
});

export default registerDatabase;
