import 'reflect-metadata';
import Fastify from 'fastify';
import {
  ConfigurationError,
  managerApiEnvironment,
  type ManagerApiEnvironment,
} from '@protege-mais/config';
import {
  registerCors,
  registerDatabase,
  registerErrorHandler,
  registerI18next,
  registerMultipart,
} from '@protege-mais/plugins';
import swaggerPlugin from './plugins/swagger/index.js';
import healthRoutes from './routes/health.route.js';
import routes from './routes/index.js';

export async function buildServer(
  configuration: ManagerApiEnvironment = managerApiEnvironment()
) {
  const app = Fastify({ logger: { level: configuration.logLevel } });

  await app.register(registerErrorHandler);
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
  await app.register(routes, { prefix: '/api/v1' });

  return app;
}

async function start() {
  const configuration = managerApiEnvironment();
  const app = await buildServer(configuration);

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  try {
    await app.listen({
      port: configuration.port,
      host: configuration.host,
    });
  } catch (error) {
    app.log.error(error);
    await app.close();
    process.exit(1);
  }
}

void start().catch((error: unknown) => {
  if (error instanceof ConfigurationError) {
    process.stderr.write(`${error.message}\n`);
  } else {
    process.stderr.write('Falha inesperada ao iniciar a Manager API.\n');
  }
  process.exitCode = 1;
});
