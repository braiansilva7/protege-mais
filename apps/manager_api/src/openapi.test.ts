import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Pool } from 'pg';
import type { ManagerApiEnvironment } from '@protege-mais/config';
import type {
  AppDatabase,
  DatabaseConnection,
  RedisConnection,
} from '@protege-mais/plugins';
import {
  apiTags,
  bearerAuthSecurity,
  healthSchema,
} from '@protege-mais/schema';
import { buildServer } from './app.js';

type JsonObject = Record<string, unknown>;

const baseConfiguration: ManagerApiEnvironment = Object.freeze({
  appEnvironment: 'LOCAL',
  host: '127.0.0.1',
  port: 3000,
  corsOrigins: Object.freeze(['http://localhost:5173']),
  databaseUrl: 'postgresql://test:test@127.0.0.1:5432/protege_mais_test',
  jwtAccessSecret: 'test-access-secret-with-at-least-thirty-two-bytes',
  jwtRefreshSecret: 'test-refresh-secret-with-at-least-thirty-two-bytes',
  redisUrl: 'redis://127.0.0.1:6379/0',
  logLevel: 'silent',
});

function createReadyRedisConnection(): RedisConnection {
  return {
    namespace: 'protege-mais:local:',
    commands: {
      get: () => Promise.resolve(null),
      set: () => Promise.resolve(),
      setWithExpiration: () => Promise.resolve(),
      delete: () => Promise.resolve(0),
      expire: () => Promise.resolve(false),
      incrementWithExpiration: () =>
        Promise.resolve({ value: 1, ttlSeconds: 60 }),
    },
    connect: () => Promise.resolve(),
    start: () => undefined,
    isReady: () => Promise.resolve(true),
    close: () => Promise.resolve(),
  };
}

function createReadyDatabaseConnection(): DatabaseConnection {
  const pool = new Pool({ allowExitOnIdle: true });
  let closeTask: Promise<void> | undefined;

  return {
    database: Object.create(null) as AppDatabase,
    pool,
    connect: () => Promise.resolve(),
    start: () => undefined,
    isReady: () => Promise.resolve(true),
    close: () => {
      closeTask ??= pool.end();
      return closeTask;
    },
  };
}

function buildOpenApiServer(
  configuration: ManagerApiEnvironment = baseConfiguration
) {
  return buildServer(configuration, {
    redisConnection: createReadyRedisConnection(),
    databaseConnection: createReadyDatabaseConnection(),
  });
}

const httpMethods = [
  'delete',
  'get',
  'head',
  'options',
  'patch',
  'post',
  'put',
  'trace',
] as const;

function asObject(value: unknown, context: string): JsonObject {
  assert.equal(typeof value, 'object', `${context} deve ser um objeto JSON.`);
  assert.notEqual(value, null, `${context} não pode ser null.`);
  assert.equal(
    Array.isArray(value),
    false,
    `${context} não pode ser um array.`
  );
  return value as JsonObject;
}

function property(value: unknown, key: string, context: string): unknown {
  const object = asObject(value, context);
  assert.ok(key in object, `${context} deve declarar ${key}.`);
  return object[key];
}

function openApiOperation(
  document: JsonObject,
  path: string,
  method: (typeof httpMethods)[number]
) {
  const paths = asObject(property(document, 'paths', 'OpenAPI'), 'paths');
  const pathItem = asObject(property(paths, path, 'paths'), `paths.${path}`);
  return asObject(
    property(pathItem, method, `paths.${path}`),
    `paths.${path}.${method}`
  );
}

function responseReference(
  document: JsonObject,
  path: string,
  method: (typeof httpMethods)[number],
  statusCode: string
) {
  const operation = openApiOperation(document, path, method);
  const responses = asObject(
    property(operation, 'responses', `${method.toUpperCase()} ${path}`),
    `${method.toUpperCase()} ${path}.responses`
  );
  const response = asObject(
    property(
      responses,
      statusCode,
      `${method.toUpperCase()} ${path}.responses`
    ),
    `${method.toUpperCase()} ${path}.responses.${statusCode}`
  );
  const content = asObject(
    property(response, 'content', `${path}.${statusCode}`),
    `${path}.${statusCode}.content`
  );
  const mediaType = asObject(
    property(content, 'application/json', `${path}.${statusCode}.content`),
    `${path}.${statusCode}.content.application/json`
  );
  const schema = asObject(
    property(mediaType, 'schema', `${path}.${statusCode}.application/json`),
    `${path}.${statusCode}.application/json.schema`
  );
  return property(schema, '$ref', `${path}.${statusCode}.schema`);
}

function resolveJsonPointer(document: JsonObject, reference: string) {
  assert.match(
    reference,
    /^#\//,
    `Referência externa não permitida: ${reference}`
  );

  let current: unknown = document;
  for (const token of reference
    .slice(2)
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))) {
    current = property(current, token, reference);
  }

  return current;
}

function validateOpenApiStructure(document: JsonObject) {
  assert.equal(document.openapi, '3.1.0');
  asObject(property(document, 'info', 'OpenAPI'), 'info');
  const paths = asObject(property(document, 'paths', 'OpenAPI'), 'paths');
  const components = asObject(
    property(document, 'components', 'OpenAPI'),
    'components'
  );
  asObject(property(components, 'schemas', 'components'), 'components.schemas');
  asObject(
    property(components, 'securitySchemes', 'components'),
    'components.securitySchemes'
  );

  const operationIds = new Set<string>();

  for (const [path, pathValue] of Object.entries(paths)) {
    assert.match(path, /^\//);
    const pathItem = asObject(pathValue, `paths.${path}`);

    for (const method of httpMethods) {
      if (!(method in pathItem)) continue;

      const operation = asObject(
        pathItem[method],
        `${method.toUpperCase()} ${path}`
      );
      assert.equal(typeof operation.summary, 'string');
      assert.notEqual(operation.summary, '');
      assert.equal(typeof operation.description, 'string');
      assert.notEqual(operation.description, '');
      assert.ok(Array.isArray(operation.tags));
      assert.ok(operation.tags.length > 0);
      const { operationId } = operation;
      if (typeof operationId !== 'string') {
        assert.fail(
          `${method.toUpperCase()} ${path} deve declarar operationId.`
        );
      }
      assert.equal(operationIds.has(operationId), false);
      operationIds.add(operationId);
      assert.ok(
        Object.keys(
          asObject(
            property(operation, 'responses', `${method.toUpperCase()} ${path}`),
            `${method.toUpperCase()} ${path}.responses`
          )
        ).length > 0
      );
    }
  }

  function validateReferences(value: unknown): void {
    if (Array.isArray(value)) {
      for (const item of value) validateReferences(item);
      return;
    }

    if (typeof value !== 'object' || value === null) return;

    for (const [key, item] of Object.entries(value)) {
      if (key === '$ref') {
        if (typeof item !== 'string') assert.fail('$ref deve ser uma string.');
        resolveJsonPointer(document, item);
      } else {
        validateReferences(item);
      }
    }
  }

  validateReferences(document);
}

function collectExamples(value: unknown, examples: unknown[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectExamples(item, examples);
    return;
  }

  if (typeof value !== 'object' || value === null) return;

  for (const [key, item] of Object.entries(value)) {
    if (key === 'example' || key === 'examples') examples.push(item);
    collectExamples(item, examples);
  }
}

void test('gera OpenAPI 3.1 estruturalmente válido e preserva o contrato operacional', async () => {
  const app = await buildOpenApiServer();

  try {
    await app.ready();
    const generatedDocument = app.swagger();
    const serializedDocument = JSON.stringify(generatedDocument);
    const document = asObject(JSON.parse(serializedDocument), 'OpenAPI');

    validateOpenApiStructure(document);

    const components = asObject(document.components, 'components');
    const schemas = asObject(components.schemas, 'components.schemas');
    const errorResponse = asObject(
      property(schemas, 'ErrorResponse', 'components.schemas'),
      'components.schemas.ErrorResponse'
    );
    const securitySchemes = asObject(
      components.securitySchemes,
      'components.securitySchemes'
    );

    assert.equal(typeof errorResponse.description, 'string');
    assert.deepEqual(errorResponse.required, ['code', 'message', 'requestId']);

    assert.deepEqual(
      {
        openapi: document.openapi,
        paths: Object.keys(asObject(document.paths, 'paths')).sort(),
        schemas: Object.keys(schemas).sort(),
        securitySchemes: Object.keys(securitySchemes).sort(),
        health: {
          operationId: openApiOperation(document, '/health', 'get').operationId,
          security: openApiOperation(document, '/health', 'get').security,
          successRef: responseReference(document, '/health', 'get', '200'),
        },
        readiness: {
          operationId: openApiOperation(document, '/ready', 'get').operationId,
          security: openApiOperation(document, '/ready', 'get').security,
          successRef: responseReference(document, '/ready', 'get', '200'),
          unavailableRef: responseReference(document, '/ready', 'get', '503'),
        },
      },
      {
        openapi: '3.1.0',
        paths: [
          '/api/v1/auth/login',
          '/api/v1/auth/refresh',
          '/health',
          '/ready',
        ],
        schemas: ['ErrorResponse', 'OperationalStatus'],
        securitySchemes: ['bearerAuth'],
        health: {
          operationId: 'getHealth',
          security: [],
          successRef: '#/components/schemas/OperationalStatus',
        },
        readiness: {
          operationId: 'getReadiness',
          security: [],
          successRef: '#/components/schemas/OperationalStatus',
          unavailableRef: '#/components/schemas/ErrorResponse',
        },
      }
    );

    const examples: unknown[] = [];
    collectExamples(document, examples);
    assert.ok(examples.length > 0);
    assert.doesNotMatch(
      JSON.stringify(examples),
      /authorization|bearer\s+\S+|password|private.?key|secret|senha|token/i
    );
  } finally {
    await app.close();
  }
});

void test('documenta login público, body fechado e todas as respostas previstas', async () => {
  const app = await buildOpenApiServer();

  try {
    await app.ready();
    const document = asObject(app.swagger(), 'OpenAPI');
    const operation = openApiOperation(document, '/api/v1/auth/login', 'post');
    const requestBody = asObject(
      property(operation, 'requestBody', 'POST /api/v1/auth/login'),
      'login.requestBody'
    );
    const requestContent = asObject(
      property(requestBody, 'content', 'login.requestBody'),
      'login.requestBody.content'
    );
    const requestMediaType = asObject(
      property(requestContent, 'application/json', 'login.requestBody.content'),
      'login.requestBody.application/json'
    );
    const requestSchema = asObject(
      property(
        requestMediaType,
        'schema',
        'login.requestBody.application/json'
      ),
      'login.requestBody.schema'
    );
    const responses = asObject(
      property(operation, 'responses', 'POST /api/v1/auth/login'),
      'login.responses'
    );

    assert.equal(operation.operationId, 'loginWithEmailAndPassword');
    assert.deepEqual(operation.tags, [apiTags.authentication]);
    assert.deepEqual(operation.security, []);
    assert.equal(requestSchema.additionalProperties, false);
    assert.deepEqual(requestSchema.required, [
      'email',
      'password',
      'deviceIdentifier',
    ]);
    assert.deepEqual(Object.keys(responses).sort(), [
      '200',
      '400',
      '401',
      '429',
      '500',
      '503',
    ]);
    for (const statusCode of ['400', '401', '429', '500', '503']) {
      assert.equal(
        responseReference(document, '/api/v1/auth/login', 'post', statusCode),
        '#/components/schemas/ErrorResponse'
      );
    }
  } finally {
    await app.close();
  }
});

void test('documenta refresh público com falha uniforme de sessão', async () => {
  const app = await buildOpenApiServer();

  try {
    await app.ready();
    const document = asObject(app.swagger(), 'OpenAPI');
    const operation = openApiOperation(
      document,
      '/api/v1/auth/refresh',
      'post'
    );
    const requestBody = asObject(
      property(operation, 'requestBody', 'POST /api/v1/auth/refresh'),
      'refresh.requestBody'
    );
    const requestContent = asObject(
      property(requestBody, 'content', 'refresh.requestBody'),
      'refresh.requestBody.content'
    );
    const requestMediaType = asObject(
      property(
        requestContent,
        'application/json',
        'refresh.requestBody.content'
      ),
      'refresh.requestBody.application/json'
    );
    const requestSchema = asObject(
      property(
        requestMediaType,
        'schema',
        'refresh.requestBody.application/json'
      ),
      'refresh.requestBody.schema'
    );
    const responses = asObject(
      property(operation, 'responses', 'POST /api/v1/auth/refresh'),
      'refresh.responses'
    );

    assert.equal(operation.operationId, 'refreshAuthenticationSession');
    assert.deepEqual(operation.tags, [apiTags.authentication]);
    assert.deepEqual(operation.security, []);
    assert.equal(requestSchema.additionalProperties, false);
    assert.deepEqual(requestSchema.required, ['refreshToken']);
    assert.deepEqual(Object.keys(responses).sort(), [
      '200',
      '400',
      '401',
      '500',
    ]);
    for (const statusCode of ['400', '401', '500']) {
      assert.equal(
        responseReference(document, '/api/v1/auth/refresh', 'post', statusCode),
        '#/components/schemas/ErrorResponse'
      );
    }
  } finally {
    await app.close();
  }
});

void test('documenta o esquema de segurança nas operações protegidas', async () => {
  const app = await buildOpenApiServer();

  app.get('/api/v1/protected-contract-test', {
    schema: {
      summary: 'Validar contrato protegido',
      description: 'Rota exclusiva do teste estrutural do OpenAPI.',
      operationId: 'getProtectedContractTest',
      tags: [apiTags.health],
      security: bearerAuthSecurity,
      response: healthSchema.response,
    },
    handler: () => ({ status: 'ok' }),
  });

  try {
    await app.ready();
    const document = asObject(app.swagger(), 'OpenAPI');
    const operation = openApiOperation(
      document,
      '/api/v1/protected-contract-test',
      'get'
    );

    assert.deepEqual(operation.security, [{ bearerAuth: [] }]);
    assert.deepEqual(
      responseReference(
        document,
        '/api/v1/protected-contract-test',
        'get',
        '200'
      ),
      '#/components/schemas/OperationalStatus'
    );
  } finally {
    await app.close();
  }
});

void test('impede o registro de rota sem contrato HTTP completo', async () => {
  const app = await buildOpenApiServer();

  try {
    assert.throws(
      () => app.get('/api/v1/undocumented-contract-test', () => ({ ok: true })),
      /deve declarar um schema HTTP/
    );
    assert.throws(
      () =>
        app.get('/api/v1/implicit-security-contract-test', {
          schema: {
            summary: 'Contrato incompleto',
            description: 'Rota exclusiva do teste da guarda de schemas.',
            operationId: 'getImplicitSecurityContractTest',
            tags: [apiTags.health],
            response: healthSchema.response,
          },
          handler: () => ({ status: 'ok' }),
        }),
      /deve declarar schema.security/
    );
  } finally {
    await app.close();
  }
});

void test('expõe Swagger em ambientes internos e o bloqueia em produção', async () => {
  const localApp = await buildOpenApiServer();
  const productionApp = await buildOpenApiServer({
    ...baseConfiguration,
    appEnvironment: 'PROD',
  });

  try {
    const localUi = await localApp.inject({ method: 'GET', url: '/swagger/' });
    const localJson = await localApp.inject({
      method: 'GET',
      url: '/swagger/json',
    });
    const localYaml = await localApp.inject({
      method: 'GET',
      url: '/swagger/yaml',
    });
    const productionUi = await productionApp.inject({
      method: 'GET',
      url: '/swagger/',
    });
    const productionJson = await productionApp.inject({
      method: 'GET',
      url: '/swagger/json',
    });

    assert.equal(localUi.statusCode, 200);
    assert.match(
      localUi.headers['content-security-policy'] ?? '',
      /default-src/
    );
    assert.equal(localJson.statusCode, 200);
    assert.equal(localJson.json<{ openapi: string }>().openapi, '3.1.0');
    assert.equal(localYaml.statusCode, 200);
    assert.match(localYaml.body, /^openapi: 3\.1\.0/m);
    assert.equal(productionUi.statusCode, 404);
    assert.equal(productionJson.statusCode, 404);

    await productionApp.ready();
    assert.equal(asObject(productionApp.swagger(), 'OpenAPI').openapi, '3.1.0');
  } finally {
    await Promise.all([localApp.close(), productionApp.close()]);
  }
});
