import {
  workerEnvironment,
  type WorkerEnvironment,
} from '@protege-mais/config';
import {
  createCorrelatedLogger,
  createStructuredLogger,
  createWorkerCorrelationContext,
  type CorrelationMetadata,
} from '@protege-mais/plugins/logging';
import {
  createRedisConnection,
  type RedisConnection,
} from '@protege-mais/plugins/redis';
import { waitForShutdown } from './lifecycle.js';

export type WorkerLogger = ReturnType<typeof createStructuredLogger>;

export interface WorkerShellOptions {
  readonly logger?: WorkerLogger;
  readonly redisConnection?: RedisConnection;
  readonly waitForSignal?: () => Promise<NodeJS.Signals>;
}

export function createWorkerJobLogger(
  logger: WorkerLogger,
  metadata: Partial<CorrelationMetadata> = {}
) {
  const context = createWorkerCorrelationContext(metadata);
  return Object.freeze({
    context,
    logger: createCorrelatedLogger(logger, context),
  });
}

export async function runWorkerShell(
  configuration: WorkerEnvironment = workerEnvironment(),
  options: WorkerShellOptions = {}
): Promise<void> {
  const logger =
    options.logger ??
    createStructuredLogger({
      service: 'worker',
      environment: configuration.appEnvironment,
      level: configuration.logLevel,
    });
  const waitForSignal = options.waitForSignal ?? waitForShutdown;
  const redisConnection =
    options.redisConnection ??
    createRedisConnection({
      redisUrl: configuration.redisUrl,
      environment: configuration.appEnvironment,
      logger,
    });

  redisConnection.start();
  logger.info(
    { event: 'worker.ready' },
    'Worker aguardando configuração de filas.'
  );
  let signal: NodeJS.Signals;
  try {
    signal = await waitForSignal();
  } finally {
    await redisConnection.close();
  }
  logger.info({ event: 'worker.stopped', signal }, 'Worker encerrado.');
}
