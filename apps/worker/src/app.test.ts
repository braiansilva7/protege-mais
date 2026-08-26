import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { test } from 'node:test';
import type { WorkerEnvironment } from '@protege-mais/config';
import { createStructuredLogger } from '@protege-mais/plugins/logging';
import { createWorkerJobLogger, runWorkerShell } from './app.js';

const configuration: WorkerEnvironment = Object.freeze({
  appEnvironment: 'LOCAL',
  logLevel: 'info',
});

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

  await runWorkerShell(configuration, {
    logger: capture.logger,
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
