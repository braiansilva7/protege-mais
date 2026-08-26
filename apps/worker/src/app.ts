import {
  workerEnvironment,
  type WorkerEnvironment,
} from '@protege-mais/config';
import { createStructuredLogger } from '@protege-mais/plugins/logging';
import {
  createQueueWorkerPool,
  type QueueWorkerPoolContract,
} from '@protege-mais/plugins/queues';
import {
  createRedisConnection,
  type RedisConnection,
} from '@protege-mais/plugins/redis';
import { JobUseCaseRegistry } from '@protege-mais/use-cases/jobs';
import { JobProcessor } from './job-processor.js';
import type { WorkerLogger } from './job-logger.js';
import { waitForShutdown } from './lifecycle.js';

export interface WorkerShellOptions {
  readonly logger?: WorkerLogger;
  readonly redisConnection?: RedisConnection;
  readonly queueWorkerPool?: QueueWorkerPoolContract;
  readonly jobUseCases?: JobUseCaseRegistry;
  readonly waitForSignal?: (
    abortSignal?: AbortSignal
  ) => Promise<NodeJS.Signals>;
}

export { createWorkerJobLogger, type WorkerLogger } from './job-logger.js';

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
  const jobUseCases = options.jobUseCases ?? new JobUseCaseRegistry();
  const processor = new JobProcessor(logger, jobUseCases);
  const queueWorkerPool =
    options.queueWorkerPool ??
    createQueueWorkerPool(
      {
        redisUrl: configuration.redisUrl,
        environment: configuration.appEnvironment,
        logger,
      },
      (job) => processor.process(job)
    );

  redisConnection.start();
  const shutdownWaitController = new AbortController();
  const signalTask = waitForSignal(shutdownWaitController.signal);
  let signal: NodeJS.Signals | undefined;
  try {
    const startResult = await Promise.race([
      queueWorkerPool.start().then(() => ({ ready: true }) as const),
      signalTask.then(
        (receivedSignal) =>
          ({
            ready: false,
            signal: receivedSignal,
          }) as const
      ),
    ]);
    if (startResult.ready) {
      logger.info(
        { event: 'worker.ready' },
        'Worker aguardando jobs nas filas.'
      );
      signal = await signalTask;
    } else {
      signal = startResult.signal;
    }
  } finally {
    shutdownWaitController.abort();
    try {
      await queueWorkerPool.close();
    } finally {
      await redisConnection.close();
    }
  }
  if (signal !== undefined) {
    logger.info({ event: 'worker.stopped', signal }, 'Worker encerrado.');
  }
}
