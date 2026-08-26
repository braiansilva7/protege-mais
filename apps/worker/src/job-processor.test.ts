import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { test } from 'node:test';
import {
  QueueRetryableError,
  QueueTerminalError,
  createJobEnvelope,
  type QueueJob,
} from '@protege-mais/plugins/queues';
import { createStructuredLogger } from '@protege-mais/plugins/logging';
import {
  JobUseCaseRegistry,
  RetryableJobError,
  TerminalJobError,
  type JobUseCase,
} from '@protege-mais/use-cases/jobs';
import { JobProcessor } from './job-processor.js';

function captureLogger() {
  const chunks: string[] = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });
  const logger = createStructuredLogger({
    service: 'worker-processor-test',
    environment: 'LOCAL',
    level: 'info',
    destination,
  });
  return { chunks, logger };
}

function queueJob(attempt = 1, maxAttempts = 3): QueueJob {
  return {
    queueName: 'integrations',
    jobName: 'foundation.test',
    jobId: `job-${'a'.repeat(64)}`,
    envelope: createJobEnvelope('correlation-prot-010', {
      resourceReference: 'sensitive-fixture-must-not-be-logged',
    }),
    attempt,
    maxAttempts,
  };
}

function records(chunks: readonly string[]) {
  return chunks
    .join('')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

void test('processor delega payload ao use case uma vez e registra conclusão', async () => {
  const capture = captureLogger();
  const executions: unknown[] = [];
  const useCase: JobUseCase = {
    execute: (payload) => {
      executions.push(payload);
      return Promise.resolve();
    },
  };
  const processor = new JobProcessor(
    capture.logger,
    new JobUseCaseRegistry([{ name: 'foundation.test', useCase }])
  );

  await processor.process(queueJob());
  capture.logger.flush();

  assert.equal(executions.length, 1);
  assert.deepEqual(
    records(capture.chunks).map((record) => record.event),
    ['worker.job.started', 'worker.job.completed']
  );
  assert.equal(
    capture.chunks.join('').includes('sensitive-fixture-must-not-be-logged'),
    false
  );
});

void test('processor classifica falha transitória para retry sem vazar causa', async () => {
  const capture = captureLogger();
  const useCase: JobUseCase = {
    execute: () =>
      Promise.reject(new RetryableJobError(new Error('redis://secret'))),
  };
  const processor = new JobProcessor(
    capture.logger,
    new JobUseCaseRegistry([{ name: 'foundation.test', useCase }])
  );

  await assert.rejects(
    () => processor.process(queueJob(1, 3)),
    QueueRetryableError
  );
  capture.logger.flush();

  const failure = records(capture.chunks).at(-1);
  assert.equal(failure?.event, 'worker.job.retry.scheduled');
  assert.equal(failure?.failureType, 'transient');
  assert.equal(capture.chunks.join('').includes('redis://secret'), false);
});

void test('processor encerra falha terminal, desconhecida ou sem use case', async () => {
  for (const failure of [
    new TerminalJobError(new Error('external detail')),
    new Error('unclassified detail'),
  ]) {
    const capture = captureLogger();
    const useCase: JobUseCase = {
      execute: () => Promise.reject(failure),
    };
    const processor = new JobProcessor(
      capture.logger,
      new JobUseCaseRegistry([{ name: 'foundation.test', useCase }])
    );

    await assert.rejects(
      () => processor.process(queueJob()),
      QueueTerminalError
    );
    capture.logger.flush();
    assert.equal(records(capture.chunks).at(-1)?.failureType, 'terminal');
    assert.equal(capture.chunks.join('').includes(failure.message), false);
  }

  const capture = captureLogger();
  const processor = new JobProcessor(capture.logger, new JobUseCaseRegistry());
  await assert.rejects(() => processor.process(queueJob()), QueueTerminalError);
});
