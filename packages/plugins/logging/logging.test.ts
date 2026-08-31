import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { test } from 'node:test';
import Fastify, { LogController } from 'fastify';
import {
  correlationIdHeader,
  correlationMetadata,
  createCorrelationContext,
  createWorkerCorrelationContext,
  requestIdHeader,
} from './correlation.js';
import {
  createRequestLogger,
  normalizedRequestRoute,
  registerLogging,
  requestIdFromRequest,
} from './fastify.js';
import {
  createStructuredLogger,
  createStructuredLoggerOptions,
} from './logger.js';
import {
  redactedLogValue,
  sanitizeLogValue,
  unserializableLogValue,
} from './sanitization.js';

function captureLogs() {
  const chunks: string[] = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });

  return {
    chunks,
    destination,
    records() {
      return chunks
        .join('')
        .split('\n')
        .filter((line) => line !== '')
        .map((line) => JSON.parse(line) as Record<string, unknown>);
    },
  };
}

void test('aceita IDs seguros e propaga correlationId da API para o worker', () => {
  const apiContext = createCorrelationContext({
    requestId: 'request-prot-008',
    correlationId: 'correlation-prot-008',
  });
  const workerContext = createWorkerCorrelationContext(
    correlationMetadata(apiContext),
    () => 'worker-request-prot-008'
  );

  assert.deepEqual(apiContext, {
    requestId: 'request-prot-008',
    correlationId: 'correlation-prot-008',
  });
  assert.deepEqual(workerContext, {
    requestId: 'worker-request-prot-008',
    correlationId: 'correlation-prot-008',
  });
});

void test('substitui IDs ausentes ou inválidos e usa requestId como correlação', () => {
  const generated = createCorrelationContext(
    {
      requestId: 'valor com espaço',
      correlationId: ['duplicado', 'inseguro'],
    },
    () => 'generated-prot-008'
  );

  assert.deepEqual(generated, {
    requestId: 'generated-prot-008',
    correlationId: 'generated-prot-008',
  });
});

void test('redige denylist e padrões sensíveis em qualquer profundidade', () => {
  const capture = captureLogs();
  const logger = createStructuredLogger({
    service: 'redaction-test',
    environment: 'LOCAL',
    level: 'info',
    destination: capture.destination,
  });
  const sensitive = {
    authorization: 'Bearer token-secreto-prot-008',
    identity: {
      cpf: '123.456.789-00',
      address: 'Rua Protegida, 42',
    },
    organization: {
      cnpj: '12.ABC.345/01DE-35',
    },
    occurrence: {
      relato: 'narrativa privada prot-008',
      coordinates: [-23.55052, -46.633308],
    },
    organizationUnit: {
      position: {
        longitude: -46.633_308,
        latitude: -23.550_52,
      },
    },
    organizationMember: {
      membershipId: 'membership-private-prot-021',
      registrationNumber: 'MAT-PRIVATE-008',
      jobTitle: 'Cargo operacional privado',
    },
    authenticationSession: {
      sessionId: 'session-private-prot-024',
      deviceIdentifier: 'device-private-prot-024',
      deviceName: 'device-name-private-prot-024',
      userAgent: 'user-agent-private-prot-024',
      tokenId: 'token-id-private-prot-024',
      refreshToken: 'refresh-private-prot-024',
    },
    note: 'CPF 12345678900; CNPJ 12ABC34501DE35; local -23.55052, -46.633308',
    route: '/victims/:victimId',
  };

  const sanitized = sanitizeLogValue(sensitive) as Record<string, unknown>;
  const serialized = JSON.stringify(sanitized);

  logger.info(sensitive, 'Evento operacional seguro.');
  logger.error(
    { err: new Error('mensagem-interna-prot-008') },
    'Falha operacional segura.'
  );
  logger.flush();
  const logged = capture.chunks.join('');

  assert.equal(sanitized.authorization, redactedLogValue);
  assert.doesNotMatch(
    serialized,
    /token-secreto|123\.456\.789|12345678900|12\.ABC\.345|12ABC34501DE35|Rua Protegida|narrativa privada|-23\.55052|-46\.633308|membership-private-prot-021|MAT-PRIVATE-008|Cargo operacional privado|session-private-prot-024|device-private-prot-024|device-name-private-prot-024|user-agent-private-prot-024|token-id-private-prot-024|refresh-private-prot-024/
  );
  assert.match(serialized, /\[REDACTED\]/);
  assert.match(serialized, /\/victims\/:victimId/);
  assert.doesNotMatch(
    logged,
    /token-secreto|123\.456\.789|12345678900|12\.ABC\.345|12ABC34501DE35|Rua Protegida|narrativa privada|-23\.55052|-46\.633308|membership-private-prot-021|MAT-PRIVATE-008|Cargo operacional privado|session-private-prot-024|device-private-prot-024|device-name-private-prot-024|user-agent-private-prot-024|token-id-private-prot-024|refresh-private-prot-024|mensagem-interna/
  );
  assert.match(logged, /"type":"Error"/);
});

void test('falha de serialização é substituída e não interrompe o logger', () => {
  const capture = captureLogs();
  const logger = createStructuredLogger({
    service: 'logging-test',
    environment: 'LOCAL',
    level: 'info',
    destination: capture.destination,
  });
  const unsafe = new Proxy(Object.create(null) as object, {
    ownKeys() {
      throw new Error('diagnostico-serializacao-prot-008');
    },
  });

  assert.doesNotThrow(() => {
    logger.info(unsafe, 'Registro com objeto inseguro.');
  });
  logger.flush();

  const output = capture.chunks.join('');
  assert.match(output, new RegExp(unserializableLogValue, 'u'));
  assert.doesNotMatch(output, /diagnostico-serializacao-prot-008/);
  assert.doesNotThrow(() => JSON.parse(output.trim()));
});

void test('registra sucesso e erro HTTP em JSON com rota normalizada', async () => {
  const capture = captureLogs();
  const logger = createStructuredLoggerOptions({
    service: 'manager-api-test',
    environment: 'LOCAL',
    level: 'info',
  });
  const server = Fastify({
    logger: { ...logger, stream: capture.destination },
    logController: new LogController({
      disableRequestLogging: true,
      requestIdLogLabel: 'requestId',
    }),
    genReqId: requestIdFromRequest,
    childLoggerFactory: createRequestLogger,
  });

  await server.register(registerLogging);
  server.get('/resources/:resourceId', (request) => ({
    route: normalizedRequestRoute(request),
  }));
  server.get('/failure', (_request, reply) =>
    reply.status(503).send({ available: false })
  );

  try {
    const success = await server.inject({
      method: 'GET',
      url: '/resources/private-identifier?token=token-secreto',
      headers: {
        [requestIdHeader]: 'request-http-prot-008',
        [correlationIdHeader]: 'correlation-http-prot-008',
      },
    });
    const failure = await server.inject({
      method: 'GET',
      url: '/failure',
      headers: { [requestIdHeader]: 'request-error-prot-008' },
    });
    const generated = await server.inject({
      method: 'GET',
      url: '/resources/generated',
      headers: { [requestIdHeader]: 'valor com espaço' },
    });

    assert.equal(success.headers[requestIdHeader], 'request-http-prot-008');
    assert.equal(
      success.headers[correlationIdHeader],
      'correlation-http-prot-008'
    );
    assert.equal(failure.headers[requestIdHeader], 'request-error-prot-008');
    assert.equal(
      failure.headers[correlationIdHeader],
      'request-error-prot-008'
    );
    assert.match(
      String(generated.headers[requestIdHeader]),
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
    );
    assert.equal(
      generated.headers[correlationIdHeader],
      generated.headers[requestIdHeader]
    );

    const records = capture.records();
    const successLog = records.find(
      (record) => record.requestId === 'request-http-prot-008'
    );
    const errorLog = records.find(
      (record) => record.requestId === 'request-error-prot-008'
    );

    assert.equal(successLog?.event, 'http.request.completed');
    assert.equal(successLog?.correlationId, 'correlation-http-prot-008');
    assert.equal(successLog?.method, 'GET');
    assert.equal(successLog?.route, '/resources/:resourceId');
    assert.equal(successLog?.statusCode, 200);
    assert.equal(typeof successLog?.durationMs, 'number');
    assert.equal(errorLog?.event, 'http.request.completed');
    assert.equal(errorLog?.statusCode, 503);
    assert.equal(errorLog?.level, 50);

    const serializedLogs = capture.chunks.join('');
    assert.doesNotMatch(serializedLogs, /private-identifier|token-secreto/);
  } finally {
    await server.close();
  }
});
