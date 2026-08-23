import type { AppDatabase } from '@core/plugins/database/index.js';
import type { Pool } from 'pg';
import type { TFunction } from 'i18next';

declare module 'fastify' {
  interface FastifyRequest {
    t: TFunction;
  }

  interface FastifyInstance {
    DatabaseRw: AppDatabase;
    DatabaseRo: AppDatabase;
    dbPool: Pool;
  }
}
