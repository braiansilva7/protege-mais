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
import { waitForShutdown } from './lifecycle.js';

export type WorkerLogger = ReturnType<typeof createStructuredLogger>;

export interface WorkerShellOptions {
  readonly logger?: WorkerLogger;
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

  logger.info(
    { event: 'worker.ready' },
    'Worker aguardando configuração de filas.'
  );
  const signal = await waitForSignal();
  logger.info({ event: 'worker.stopped', signal }, 'Worker encerrado.');
}
