import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ApplicationError,
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  InfrastructureError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from './index.js';

void test('mapeia cada classe para código e status HTTP estáveis', () => {
  const scenarios = [
    [new ApplicationError(), 'APPLICATION_ERROR', 500],
    [new ValidationError(), 'VALIDATION_ERROR', 400],
    [new UnauthorizedError(), 'UNAUTHORIZED', 401],
    [new ForbiddenError(), 'FORBIDDEN', 403],
    [new NotFoundError(), 'NOT_FOUND', 404],
    [new ConflictError(), 'CONFLICT', 409],
    [new BusinessRuleError(), 'BUSINESS_RULE_ERROR', 422],
    [new InfrastructureError(), 'INFRASTRUCTURE_ERROR', 500],
  ] as const;

  for (const [error, code, statusCode] of scenarios) {
    assert.ok(error instanceof Error);
    assert.ok(error instanceof ApplicationError);
    assert.equal(error.name, error.constructor.name);
    assert.equal(error.code, code);
    assert.equal(error.statusCode, statusCode);
    assert.notEqual(error.message, '');
  }
});

void test('permite código e mensagem públicos específicos sem alterar o status', () => {
  const error = new NotFoundError({
    code: 'VICTIM_NOT_FOUND',
    message: 'Perfil não encontrado.',
  });

  assert.equal(error.code, 'VICTIM_NOT_FOUND');
  assert.equal(error.message, 'Perfil não encontrado.');
  assert.equal(error.statusCode, 404);
});

void test('preserva a causa interna sem torná-la enumerável', () => {
  const cause = new Error('diagnóstico interno');
  const error = new InfrastructureError({ cause });

  assert.equal(error.cause, cause);
  assert.equal(Object.hasOwn(error, 'cause'), true);
  assert.equal(Object.keys(error).includes('cause'), false);
  assert.doesNotMatch(JSON.stringify(error), /diagnóstico interno/);
});

void test('rejeita status fora da faixa de erros HTTP', () => {
  assert.throws(() => new ApplicationError({ statusCode: 200 }), RangeError);
  assert.throws(() => new ApplicationError({ statusCode: 600 }), RangeError);
});
