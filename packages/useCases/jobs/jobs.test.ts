import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  JobUseCaseRegistry,
  RetryableJobError,
  TerminalJobError,
  type JobUseCase,
} from './index.js';

const noOperationUseCase: JobUseCase = {
  execute: () => Promise.resolve(),
};

void test('registry resolve um caso de uso sem executar regra no processor', () => {
  const registry = new JobUseCaseRegistry([
    { name: 'foundation.test', useCase: noOperationUseCase },
  ]);

  assert.equal(registry.resolve('foundation.test'), noOperationUseCase);
  assert.equal(registry.resolve('unknown.job'), undefined);
});

void test('registry rejeita nomes vazios e registros duplicados', () => {
  const registry = new JobUseCaseRegistry();

  assert.throws(
    () => registry.register({ name: '', useCase: noOperationUseCase }),
    /não pode ser vazio/u
  );
  registry.register({ name: 'foundation.test', useCase: noOperationUseCase });
  assert.throws(
    () =>
      registry.register({
        name: 'foundation.test',
        useCase: noOperationUseCase,
      }),
    /já foi registrado/u
  );
});

void test('erros de job preservam somente classificação estável', () => {
  const original = new Error('detalhe externo sensível');
  const retryable = new RetryableJobError(original);
  const terminal = new TerminalJobError(original);

  assert.equal(retryable.code, 'RETRYABLE_JOB_ERROR');
  assert.equal(retryable.cause, original);
  assert.equal(terminal.code, 'TERMINAL_JOB_ERROR');
  assert.equal(terminal.cause, original);
  assert.equal(retryable.message.includes(original.message), false);
  assert.equal(terminal.message.includes(original.message), false);
});
