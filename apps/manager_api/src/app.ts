import 'reflect-metadata';
import Fastify from 'fastify';
import {
  managerApiEnvironment,
  type ManagerApiEnvironment,
} from '@protege-mais/config';
import {
  registerCors,
  registerDatabase,
  registerErrorHandler,
  registerI18next,
  registerMultipart,
  registerReadiness,
} from '@protege-mais/plugins';
import swaggerPlugin from './plugins/swagger/index.js';
import healthRoutes from './routes/health.route.js';
import routes, { apiV1Prefix } from './routes/index.js';

export async function buildServer(
  configuration: ManagerApiEnvironment = managerApiEnvironment()
) {
  const app = Fastify({ logger: { level: configuration.logLevel } });

  await app.register(registerErrorHandler);
  await app.register(registerReadiness);
  await app.register(registerDatabase, {
    databaseUrl: configuration.databaseUrl,
  });
  await app.register(registerMultipart);
  await app.register(registerCors, {
    origins: configuration.corsOrigins,
  });
  await app.register(registerI18next);
  await app.register(swaggerPlugin);
  await app.register(healthRoutes);
  await app.register(routes, { prefix: apiV1Prefix });

  return app;
}
