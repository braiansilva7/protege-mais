import {
  QueueRetryableError,
  QueueTerminalError,
  type QueueJob,
} from '@protege-mais/plugins/queues';
import {
  JobUseCaseRegistry,
  RetryableJobError,
  TerminalJobError,
} from '@protege-mais/use-cases/jobs';
import { createWorkerJobLogger, type WorkerLogger } from './job-logger.js';

export class JobProcessor {
  readonly #logger: WorkerLogger;
  readonly #registry: JobUseCaseRegistry;

  public constructor(logger: WorkerLogger, registry: JobUseCaseRegistry) {
    this.#logger = logger;
    this.#registry = registry;
  }

  public async process(job: QueueJob): Promise<void> {
    const correlated = createWorkerJobLogger(this.#logger, {
      correlationId: job.envelope.correlationId,
    });
    const logContext = {
      queue: job.queueName,
      processor: job.jobName,
      attempt: job.attempt,
      maxAttempts: job.maxAttempts,
    } as const;
    const useCase = this.#registry.resolve(job.jobName);

    correlated.logger.info(
      { event: 'worker.job.started', ...logContext },
      'Processamento do job iniciado.'
    );

    if (useCase === undefined) {
      correlated.logger.error(
        {
          event: 'worker.job.failed',
          ...logContext,
          errorCode: 'JOB_USE_CASE_NOT_FOUND',
          failureType: 'terminal',
        },
        'Job encerrado com falha terminal.'
      );
      throw new QueueTerminalError();
    }

    const startedAt = performance.now();
    try {
      await useCase.execute(job.envelope.payload, {
        ...correlated.context,
        jobId: job.jobId,
        queueName: job.queueName,
        jobName: job.jobName,
        attempt: job.attempt,
        maxAttempts: job.maxAttempts,
      });
    } catch (error: unknown) {
      if (error instanceof RetryableJobError) {
        if (job.attempt < job.maxAttempts) {
          correlated.logger.warn(
            {
              event: 'worker.job.retry.scheduled',
              ...logContext,
              errorCode: error.code,
              failureType: 'transient',
            },
            'Nova tentativa do job será agendada.'
          );
        } else {
          correlated.logger.error(
            {
              event: 'worker.job.failed',
              ...logContext,
              errorCode: error.code,
              failureType: 'exhausted',
            },
            'Job esgotou suas tentativas.'
          );
        }
        throw new QueueRetryableError();
      }

      const errorCode =
        error instanceof TerminalJobError
          ? error.code
          : 'UNCLASSIFIED_JOB_ERROR';
      correlated.logger.error(
        {
          event: 'worker.job.failed',
          ...logContext,
          errorCode,
          failureType: 'terminal',
        },
        'Job encerrado com falha terminal.'
      );
      throw new QueueTerminalError();
    }

    correlated.logger.info(
      {
        event: 'worker.job.completed',
        ...logContext,
        durationMs: Math.max(Math.round(performance.now() - startedAt), 0),
      },
      'Processamento do job concluído.'
    );
  }
}
