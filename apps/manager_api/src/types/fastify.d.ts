import type { AppDatabase, DatabaseConnection } from '@protege-mais/plugins';
import type { Pool } from 'pg';

declare module 'fastify' {
  interface FastifyInstance {
    DatabaseRw: AppDatabase;
    DatabaseRo: AppDatabase;
    dbPool: Pool;
    databaseConnection: DatabaseConnection;
  }
}
