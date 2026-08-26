import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { workerEnvironment } from '@protege-mais/config';
import { createStructuredLogger } from '@protege-mais/plugins/logging';
import {
  createJobEnvelope,
  createQueueProducer,
  createQueueWorkerPool,
  type PublishJobInput,
  type QueueProducerContract,
  type QueueWorkerPoolContract,
} from '@protege-mais/plugins/queues';
import {
  JobUseCaseRegistry,
  RetryableJobError,
  TerminalJobError,
  type JobUseCase,
} from '@protege-mais/use-cases/jobs';
import { JobProcessor } from './job-processor.js';

const retryPolicy = Object.freeze({ attempts: 3, backoffDelayMs: 30 });

function captureLogger() {
  const chunks: string[] = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });
  const logger = createStructuredLogger({
    service: 'worker-integration-test',
    environment: 'LOCAL',
    level: 'info',
    destination,
  });
  return { chunks, logger };
}

function createPool(
  registry: JobUseCaseRegistry,
  logger: ReturnType<typeof createStructuredLogger>,
  redisUrl: string
): QueueWorkerPoolContract {
  const processor = new JobProcessor(logger, registry);
  return createQueueWorkerPool(
    {
      redisUrl,
      environment: 'LOCAL',
      logger,
      retryPolicy,
    },
    (job) => processor.process(job)
  );
}

async function waitForState(
  producer: QueueProducerContract,
  input: PublishJobInput,
  expected: string,
  timeoutMs = 5_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await producer.inspect(input))?.state === expected) return;
    await delay(10);
  }
  assert.fail(`O job não alcançou o estado ${expected} no prazo esperado.`);
}

void test('Worker processa, reexecuta, deduplica e encerra com Redis real', async () => {
  const configuration = workerEnvironment();
  const capture = captureLogger();
  const executionId = randomUUID();
  let successExecutions = 0;
  const retryTimestamps: number[] = [];
  let terminalExecutions = 0;
  let releaseShutdownJob: () => void = () => undefined;
  let markShutdownStarted: () => void = () => undefined;
  const shutdownStarted = new Promise<void>((resolve) => {
    markShutdownStarted = resolve;
  });
  const shutdownRelease = new Promise<void>((resolve) => {
    releaseShutdownJob = resolve;
  });

  const successfulUseCase: JobUseCase = {
    execute: () => {
      successExecutions += 1;
      return Promise.resolve();
    },
  };
  const retryableUseCase: JobUseCase = {
    execute: () => {
      retryTimestamps.push(Date.now());
      return retryTimestamps.length < retryPolicy.attempts
        ? Promise.reject(new RetryableJobError())
        : Promise.resolve();
    },
  };
  const terminalUseCase: JobUseCase = {
    execute: () => {
      terminalExecutions += 1;
      return Promise.reject(
        new TerminalJobError(new Error('terminal-sensitive-detail'))
      );
    },
  };
  const shutdownUseCase: JobUseCase = {
    execute: async () => {
      markShutdownStarted();
      await shutdownRelease;
    },
  };
  const registry = new JobUseCaseRegistry([
    { name: 'foundation.success', useCase: successfulUseCase },
    { name: 'foundation.retry', useCase: retryableUseCase },
    { name: 'foundation.terminal', useCase: terminalUseCase },
    { name: 'foundation.shutdown', useCase: shutdownUseCase },
  ]);
  const producer = createQueueProducer({
    redisUrl: configuration.redisUrl,
    environment: configuration.appEnvironment,
    logger: capture.logger,
    retryPolicy,
  });
  const inputs: PublishJobInput[] = [
    {
      queueName: 'integrations',
      jobName: 'foundation.success',
      idempotencyKey: `${executionId}-success`,
      envelope: createJobEnvelope(`correlation-${executionId}`, {
        resourceReference: 'fixture-success',
      }),
    },
    {
      queueName: 'notifications',
      jobName: 'foundation.retry',
      idempotencyKey: `${executionId}-retry`,
      envelope: createJobEnvelope(`correlation-${executionId}`, {
        resourceReference: 'fixture-retry',
      }),
    },
    {
      queueName: 'risk',
      jobName: 'foundation.terminal',
      idempotencyKey: `${executionId}-terminal`,
      envelope: createJobEnvelope(`correlation-${executionId}`, {
        resourceReference: 'fixture-terminal-sensitive',
      }),
    },
    {
      queueName: 'evidences',
      jobName: 'foundation.shutdown',
      idempotencyKey: `${executionId}-shutdown`,
      envelope: createJobEnvelope(`correlation-${executionId}`, {
        resourceReference: 'fixture-shutdown',
      }),
    },
  ];
  let pool = createPool(registry, capture.logger, configuration.redisUrl);

  try {
    await pool.start();

    await Promise.all([
      producer.publish(inputs[0]),
      producer.publish(inputs[0]),
    ]);
    await waitForState(producer, inputs[0], 'completed');
    assert.equal(successExecutions, 1);

    await pool.close();
    pool = createPool(registry, capture.logger, configuration.redisUrl);
    await pool.start();
    await producer.publish(inputs[0]);
    await delay(80);
    assert.equal(successExecutions, 1);
    assert.equal((await producer.inspect(inputs[0]))?.state, 'completed');

    await producer.publish(inputs[1]);
    await waitForState(producer, inputs[1], 'completed');
    assert.equal(retryTimestamps.length, retryPolicy.attempts);
    assert.equal(retryTimestamps[1] - retryTimestamps[0] >= 20, true);
    assert.equal(retryTimestamps[2] - retryTimestamps[1] >= 45, true);

    await producer.publish(inputs[2]);
    await waitForState(producer, inputs[2], 'failed');
    assert.equal(terminalExecutions, 1);
    assert.equal((await producer.inspect(inputs[2]))?.attemptsMade, 1);

    await producer.publish(inputs[3]);
    await shutdownStarted;
    const closeTask = pool.close();
    assert.equal(
      await Promise.race([
        closeTask.then(() => 'closed'),
        delay(50).then(() => 'processing'),
      ]),
      'processing'
    );
    releaseShutdownJob();
    await closeTask;
    await waitForState(producer, inputs[3], 'completed');

    capture.logger.flush();
    const serializedLogs = capture.chunks.join('');
    assert.equal(serializedLogs.includes('terminal-sensitive-detail'), false);
    assert.equal(serializedLogs.includes('fixture-terminal-sensitive'), false);
    assert.equal(serializedLogs.includes('worker.job.retry.scheduled'), true);
    assert.equal(serializedLogs.includes('worker.job.failed'), true);
    assert.equal(serializedLogs.includes('"failureType":"terminal"'), true);
  } finally {
    releaseShutdownJob();
    await pool.close().catch(() => undefined);
    for (const input of inputs) {
      await producer.removeSettled(input).catch(() => false);
    }
    await producer.close();
  }
});
