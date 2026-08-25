import fp from 'fastify-plugin';
import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { container } from 'tsyringe';
import type { FastifyInstance } from 'fastify';
import * as schema from '@protege-mais/models';

export type AppDatabase = NodePgDatabase<typeof schema>;

export interface DatabasePluginOptions {
  readonly databaseUrl: string;
}

function databasePlugin(
  fastify: FastifyInstance,
  options: DatabasePluginOptions
) {
  const pool = new Pool({ connectionString: options.databaseUrl });
  const db = drizzle(pool, { schema });

  container.register<AppDatabase>('DatabaseRw', { useValue: db });
  container.register<AppDatabase>('DatabaseRo', { useValue: db });

  fastify.decorate('DatabaseRw', db);
  fastify.decorate('DatabaseRo', db);
  fastify.decorate('dbPool', pool);

  fastify.addHook('onClose', async () => {
    await pool.end();
  });
}

export const registerDatabase = fp<DatabasePluginOptions>(databasePlugin, {
  name: 'database',
});
export default registerDatabase;
