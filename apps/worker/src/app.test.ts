import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { test } from 'node:test';
import type { WorkerEnvironment } from '@protege-mais/config';
import { createStructuredLogger } from '@protege-mais/plugins/logging';
import type { RedisConnection } from '@protege-mais/plugins/redis';
import type { QueueWorkerPoolContract } from '@protege-mais/plugins/queues';
import { createWorkerJobLogger, runWorkerShell } from './app.js';
import { waitForShutdown } from './lifecycle.js';

const configuration: WorkerEnvironment = Object.freeze({
  appEnvironment: 'LOCAL',
  redisUrl: 'redis://127.0.0.1:6379/0',
  logLevel: 'info',
});

function createTestRedisConnection(onClose = () => undefined): RedisConnection {
  return {
    namespace: 'protege-mais:local:',
    commands: {
      get: () => Promise.resolve(null),
      set: () => Promise.resolve(),
      setWithExpiration: () => Promise.resolve(),
      delete: () => Promise.resolve(0),
      expire: () => Promise.resolve(false),
    },
    connect: () => Promise.resolve(),
    start: () => undefined,
    isReady: () => Promise.resolve(true),
    close: () => {
      onClose();
      return Promise.resolve();
    },
  };
}

function createTestQueueWorkerPool(
  onStart = () => undefined,
  onClose = () => undefined
): QueueWorkerPoolContract {
  return {
    start: () => {
      onStart();
      return Promise.resolve();
    },
    close: () => {
      onClose();
      return Promise.resolve();
    },
  };
}

function captureLogger() {
  const chunks: string[] = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });
  const logger = createStructuredLogger({
    service: 'worker-test',
    environment: 'LOCAL',
    level: 'info',
    destination,
  });

  return { chunks, logger };
}

void test('worker registra ciclo de vida em JSON', async () => {
  const capture = captureLogger();
  let redisCloses = 0;
  let queueStarts = 0;
  let queueCloses = 0;

  await runWorkerShell(configuration, {
    logger: capture.logger,
    redisConnection: createTestRedisConnection(() => {
      redisCloses += 1;
    }),
    queueWorkerPool: createTestQueueWorkerPool(
      () => {
        queueStarts += 1;
      },
      () => {
        queueCloses += 1;
      }
    ),
    waitForSignal: () => Promise.resolve<NodeJS.Signals>('SIGTERM'),
  });
  capture.logger.flush();

  const records = capture.chunks
    .join('')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, unknown>);

  assert.deepEqual(
    records.map((record) => record.event),
    ['worker.ready', 'worker.stopped']
  );
  assert.equal(records[1]?.signal, 'SIGTERM');
  assert.equal(
    records.every((record) => record.service === 'worker-test'),
    true
  );
  assert.equal(redisCloses, 1);
  assert.equal(queueStarts, 1);
  assert.equal(queueCloses, 1);
});

void test('worker cria novo requestId e preserva correlationId do job', () => {
  const capture = captureLogger();
  const job = createWorkerJobLogger(capture.logger, {
    correlationId: 'correlation-job-prot-008',
  });

  job.logger.info({ event: 'worker.job.received' }, 'Job recebido.');
  capture.logger.flush();

  assert.notEqual(job.context.requestId, job.context.correlationId);
  assert.equal(job.context.correlationId, 'correlation-job-prot-008');

  const record = JSON.parse(capture.chunks.join('').trim()) as Record<
    string,
    unknown
  >;
  assert.equal(record.requestId, job.context.requestId);
  assert.equal(record.correlationId, 'correlation-job-prot-008');
});

void test('worker encerra por sinal recebido durante conexão inicial', async () => {
  const capture = captureLogger();
  let queueCloses = 0;
  let redisCloses = 0;

  await runWorkerShell(configuration, {
    logger: capture.logger,
    redisConnection: createTestRedisConnection(() => {
      redisCloses += 1;
    }),
    queueWorkerPool: {
      start: () => new Promise(() => undefined),
      close: () => {
        queueCloses += 1;
        return Promise.resolve();
      },
    },
    waitForSignal: () => Promise.resolve<NodeJS.Signals>('SIGTERM'),
  });
  capture.logger.flush();

  assert.equal(queueCloses, 1);
  assert.equal(redisCloses, 1);
  assert.deepEqual(
    capture.chunks
      .join('')
      .trim()
      .split('\n')
      .map((line) => (JSON.parse(line) as Record<string, unknown>).event),
    ['worker.stopped']
  );
});

void test('espera cancelada remove listeners de shutdown', async () => {
  const controller = new AbortController();
  const initialSigintListeners = process.listenerCount('SIGINT');
  const initialSigtermListeners = process.listenerCount('SIGTERM');
  const waitTask = waitForShutdown(controller.signal);

  controller.abort();

  await assert.rejects(waitTask, /foi cancelada/u);
  assert.equal(process.listenerCount('SIGINT'), initialSigintListeners);
  assert.equal(process.listenerCount('SIGTERM'), initialSigtermListeners);
});
