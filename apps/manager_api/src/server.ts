import 'reflect-metadata';
import Fastify from 'fastify';
import { managerApiEnvironment } from '@core/config/environments.js';
import { registerCors } from '@core/plugins/cors.js';
import { registerDatabase } from '@core/plugins/database/index.js';
import { registerMultipart } from '@core/plugins/multipart/index.js';
import i18nextPlugin from '@core/plugins/i18next/index.js';
import healthRoutes from '@/routes/health.route.js';
import routes from '@/routes/index.js';
import swaggerPlugin from '@/plugins/swagger/index.js';

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

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
  } catch (error) {
    app.log.error(error);
    await app.close();
    process.exit(1);
  }
}

void start();
