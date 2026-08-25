import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  InfrastructureError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  type ErrorResponse,
} from '@protege-mais/common';
import { registerErrorHandler } from './index.js';

const requestId = 'request-test-004';

function assertErrorResponse(
  response: { readonly statusCode: number; readonly body: string },
  expectedCode: string,
  expectedStatusCode: number
) {
  assert.equal(response.statusCode, expectedStatusCode);

  const body = JSON.parse(response.body) as ErrorResponse;
  assert.deepEqual(Object.keys(body).sort(), ['code', 'message', 'requestId']);
  assert.equal(body.code, expectedCode);
  assert.equal(body.requestId, requestId);
  assert.notEqual(body.message, '');
  assert.doesNotMatch(response.body, /"cause"|"stack"/);
}

async function createTestServer() {
  const server = Fastify({
    logger: false,
    genReqId: () => requestId,
  });
  await server.register(registerErrorHandler);
  return server;
}

function registerExpectedErrorRoutes(server: FastifyInstance) {
  const scenarios = [
    ['/validation', () => new ValidationError()],
    ['/unauthorized', () => new UnauthorizedError()],
    ['/forbidden', () => new ForbiddenError()],
    ['/not-found', () => new NotFoundError()],
    ['/conflict', () => new ConflictError()],
    ['/business-rule', () => new BusinessRuleError()],
  ] as const;

  for (const [path, createError] of scenarios) {
    server.get(path, () => {
      throw createError();
    });
  }
}

void test('responde erros previstos com status, código e requestId', async () => {
  const server = await createTestServer();
  registerExpectedErrorRoutes(server);

  const scenarios = [
    ['/validation', 'VALIDATION_ERROR', 400],
    ['/unauthorized', 'UNAUTHORIZED', 401],
    ['/forbidden', 'FORBIDDEN', 403],
    ['/not-found', 'NOT_FOUND', 404],
    ['/conflict', 'CONFLICT', 409],
    ['/business-rule', 'BUSINESS_RULE_ERROR', 422],
  ] as const;

  try {
    for (const [url, code, statusCode] of scenarios) {
      const response = await server.inject({ method: 'GET', url });
      assertErrorResponse(response, code, statusCode);
    }
  } finally {
    await server.close();
  }
});

void test('padroniza rota inexistente sem refletir a URL', async () => {
  const server = await createTestServer();

  try {
    const response = await server.inject({
      method: 'GET',
      url: '/private-resource/secret-value',
    });

    assertErrorResponse(response, 'NOT_FOUND', 404);
    assert.doesNotMatch(response.body, /private-resource|secret-value/);
  } finally {
    await server.close();
  }
});

void test('sanitiza detalhes e valores de erros de schema do Fastify', async () => {
  const server = await createTestServer();
  const sensitiveValue = 'senha-que-nao-pode-vazar';

  server.post('/schema-validation', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 12 },
        },
      },
    },
    handler: () => ({ ok: true }),
  });

  try {
    const response = await server.inject({
      method: 'POST',
      url: '/schema-validation',
      payload: {
        email: 'valor-invalido',
        password: sensitiveValue,
      },
    });

    assertErrorResponse(response, 'VALIDATION_ERROR', 400);
    assert.doesNotMatch(response.body, /email|password|valor-invalido/);
    assert.doesNotMatch(response.body, new RegExp(sensitiveValue));
  } finally {
    await server.close();
  }
});

void test('transforma erro desconhecido em 500 e mantém o original só no log', async () => {
  const logChunks: string[] = [];
  const logStream = new Writable({
    write(chunk, _encoding, callback) {
      logChunks.push(String(chunk));
      callback();
    },
  });
  const server = Fastify({
    logger: { level: 'error', stream: logStream },
    genReqId: () => requestId,
  });
  await server.register(registerErrorHandler);

  const internalDiagnostic = 'internal-diagnostic-004';
  const infrastructureDiagnostic = 'database-driver-diagnostic-004';

  server.get('/unknown', () => {
    throw new Error(internalDiagnostic);
  });
  server.get('/infrastructure', () => {
    throw new InfrastructureError({
      cause: new Error(infrastructureDiagnostic),
    });
  });

  try {
    const unknownResponse = await server.inject({
      method: 'GET',
      url: '/unknown',
    });
    const infrastructureResponse = await server.inject({
      method: 'GET',
      url: '/infrastructure',
    });

    assertErrorResponse(unknownResponse, 'INTERNAL_SERVER_ERROR', 500);
    assertErrorResponse(infrastructureResponse, 'INFRASTRUCTURE_ERROR', 500);
    assert.doesNotMatch(unknownResponse.body, new RegExp(internalDiagnostic));
    assert.doesNotMatch(
      infrastructureResponse.body,
      new RegExp(infrastructureDiagnostic)
    );

    const logs = logChunks.join('');
    assert.match(logs, new RegExp(internalDiagnostic));
    assert.match(logs, new RegExp(infrastructureDiagnostic));
    assert.match(logs, new RegExp(requestId));
  } finally {
    await server.close();
  }
});
