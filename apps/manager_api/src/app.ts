import 'reflect-metadata';
import Fastify, { LogController } from 'fastify';
import {
  managerApiEnvironment,
  type ManagerApiEnvironment,
} from '@protege-mais/config';
import {
  registerCors,
  registerDatabase,
  registerErrorHandler,
  registerI18next,
  registerLogging,
  registerMultipart,
  registerReadiness,
} from '@protege-mais/plugins';
import {
  createRequestLogger,
  createStructuredLoggerOptions,
  requestIdFromRequest,
  type LogDestination,
} from '@protege-mais/plugins/logging';
import swaggerPlugin from './plugins/swagger/index.js';
import healthRoutes from './routes/health.route.js';
import routes, { apiV1Prefix } from './routes/index.js';

export interface BuildServerOptions {
  readonly logDestination?: LogDestination;
}

export async function buildServer(
  configuration: ManagerApiEnvironment = managerApiEnvironment(),
  options: BuildServerOptions = {}
) {
  const logger = createStructuredLoggerOptions({
    service: 'manager-api',
    environment: configuration.appEnvironment,
    level: configuration.logLevel,
  });
  const app = Fastify({
    logger:
      options.logDestination === undefined
        ? logger
        : { ...logger, stream: options.logDestination },
    logController: new LogController({
      disableRequestLogging: true,
      requestIdLogLabel: 'requestId',
    }),
    genReqId: requestIdFromRequest,
    childLoggerFactory: createRequestLogger,
  });

  await app.register(registerLogging);
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
  await app.register(swaggerPlugin, {
    exposeUi: configuration.appEnvironment !== 'PROD',
  });
  await app.register(healthRoutes);
  await app.register(routes, { prefix: apiV1Prefix });

  return app;
}
