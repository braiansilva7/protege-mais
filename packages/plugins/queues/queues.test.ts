import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createJobEnvelope,
  jobContractVersion,
  queueDefaultRetryPolicy,
  queueJobDataMaximumBytes,
  queueJobId,
  queueKeyPrefix,
  queueNames,
} from './index.js';

void test('catálogo e política base das filas permanecem explícitos', () => {
  assert.deepEqual(queueNames, [
    'emergency',
    'notifications',
    'integrations',
    'evidences',
    'risk',
  ]);
  assert.deepEqual(queueDefaultRetryPolicy, {
    attempts: 3,
    backoffDelayMs: 1_000,
  });
  assert.equal(queueKeyPrefix('LOCAL'), 'protege-mais:local:queues');
});

void test('envelope versão 1 aceita apenas payload JSON pequeno e correlação válida', () => {
  const envelope = createJobEnvelope('correlation-prot-010', {
    resourceReference: 'reference-42',
  });

  assert.deepEqual(envelope, {
    version: jobContractVersion,
    correlationId: 'correlation-prot-010',
    payload: { resourceReference: 'reference-42' },
  });
  assert.throws(
    () => createJobEnvelope('correlation-prot-010', { accessToken: 'secret' }),
    /campo proibido/u
  );
  assert.throws(
    () =>
      createJobEnvelope('correlation-prot-010', {
        resourceReference: new Date(),
      }),
    /objetos JSON simples/u
  );
  assert.throws(
    () => createJobEnvelope('correlation com espaço', {}),
    /envelope do job é inválido/u
  );
  assert.throws(
    () =>
      createJobEnvelope('correlation-prot-010', {
        reference: 'x'.repeat(queueJobDataMaximumBytes),
      }),
    /excede o tamanho/u
  );
});

void test('jobId é estável, opaco e separado por tipo de job', () => {
  const first = queueJobId('foundation.test', 'operation:42');
  const repeated = queueJobId('foundation.test', 'operation:42');
  const otherJob = queueJobId('foundation.other', 'operation:42');

  assert.match(first, /^job-[a-f0-9]{64}$/u);
  assert.equal(first, repeated);
  assert.notEqual(first, otherJob);
  assert.equal(first.includes('operation'), false);
  assert.throws(() => queueJobId('Invalid Job', 'operation:42'), /inválido/u);
  assert.throws(() => queueJobId('foundation.test', ' '), /inválida/u);
});
