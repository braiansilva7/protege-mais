import 'reflect-metadata';
import Fastify from 'fastify';
import { managerApiEnvironment } from '@protege-mais/config';
import {
  i18nextPlugin,
  registerCors,
  registerDatabase,
  registerMultipart,
} from '@protege-mais/plugins';
import swaggerPlugin from './plugins/swagger/index.js';
import healthRoutes from './routes/health.route.js';
import routes from './routes/index.js';

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(registerDatabase);
  await app.register(registerMultipart);
  await app.register(registerCors);
  await app.register(i18nextPlugin);
  await app.register(swaggerPlugin);
  await app.register(healthRoutes);
  await app.register(routes, { prefix: '/api/v1' });

  return app;
}

async function start() {
  const config = managerApiEnvironment();
  const app = await buildServer();

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
  } catch (error) {
    app.log.error(error);
    await app.close();
    process.exit(1);
  }
}

void start();
