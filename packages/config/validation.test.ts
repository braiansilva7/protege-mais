import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ConfigurationError,
  createDatabaseEnvironment,
  createEncryptionEnvironment,
  createJwtEnvironment,
  createManagerApiEnvironment,
  createMobileEnvironment,
  createRedisEnvironment,
  createS3Environment,
  createSmtpEnvironment,
  createWebEnvironment,
  createWorkerEnvironment,
  type EnvironmentSource,
} from './validation.js';

function expectConfigurationError(
  action: () => unknown,
  key: string,
  reason: ConfigurationError['reason'],
  forbiddenValue?: string
) {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof ConfigurationError);
    assert.equal(error.reason, reason);
    assert.ok(error.keys.includes(key));
    assert.match(error.message, new RegExp(key));
    if (forbiddenValue) {
      assert.doesNotMatch(error.message, new RegExp(forbiddenValue));
    }
    return true;
  });
}

const managerSource: EnvironmentSource = {
  APP_ENVIRONMENT: 'LOCAL',
  API_HOST: '0.0.0.0',
  API_PORT: '3000',
  CORS_ORIGIN: 'http://localhost:5173,http://localhost:5173/',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/protege_mais',
  REDIS_URL: 'redis://localhost:6379/0',
  LOG_LEVEL: 'debug',
};

void test('cria configurações mínimas, tipadas e imutáveis para cada app', () => {
  const manager = createManagerApiEnvironment(managerSource);
  const worker = createWorkerEnvironment({
    APP_ENVIRONMENT: 'DEV',
    REDIS_URL: 'redis://localhost:6379/0',
  });
  const web = createWebEnvironment({
    VITE_APP_ENVIRONMENT: 'HMG',
    VITE_API_URL: 'https://api.hmg.example.test/api/v1',
  });
  const mobile = createMobileEnvironment({
    EXPO_PUBLIC_APP_ENVIRONMENT: 'PROD',
    EXPO_PUBLIC_API_URL: 'https://api.example.test/api/v1',
  });

  assert.deepEqual(manager, {
    appEnvironment: 'LOCAL',
    host: '0.0.0.0',
    port: 3000,
    corsOrigins: ['http://localhost:5173'],
    databaseUrl: managerSource.DATABASE_URL,
    redisUrl: managerSource.REDIS_URL,
    logLevel: 'debug',
  });
  assert.deepEqual(worker, {
    appEnvironment: 'DEV',
    redisUrl: 'redis://localhost:6379/0',
    logLevel: 'info',
  });
  assert.equal(web.appEnvironment, 'HMG');
  assert.equal(mobile.appEnvironment, 'PROD');
  assert.ok(Object.isFrozen(manager));
  assert.ok(Object.isFrozen(manager.corsOrigins));
  assert.ok(Object.isFrozen(worker));
  assert.ok(Object.isFrozen(web));
  assert.ok(Object.isFrozen(mobile));
});

void test('informa a chave ausente sem incluir valores de outras variáveis', () => {
  const secretValue = 'valor-que-nao-pode-vazar';
  expectConfigurationError(
    () =>
      createManagerApiEnvironment({
        ...managerSource,
        DATABASE_URL: undefined,
        JWT_ACCESS_SECRET: secretValue,
      }),
    'DATABASE_URL',
    'MISSING',
    secretValue
  );
});

void test('rejeita ambiente, host, porta, origem, URL e log level inválidos', () => {
  const scenarios: readonly {
    readonly key: string;
    readonly source: EnvironmentSource;
  }[] = [
    {
      key: 'APP_ENVIRONMENT',
      source: { ...managerSource, APP_ENVIRONMENT: 'QA' },
    },
    {
      key: 'API_HOST',
      source: { ...managerSource, API_HOST: 'http://localhost' },
    },
    {
      key: 'API_HOST',
      source: { ...managerSource, API_HOST: 'invalid_host!' },
    },
    { key: 'API_PORT', source: { ...managerSource, API_PORT: '3e3' } },
    { key: 'API_PORT', source: { ...managerSource, API_PORT: '65536' } },
    {
      key: 'CORS_ORIGIN',
      source: {
        ...managerSource,
        CORS_ORIGIN: 'http://localhost:5173/path',
      },
    },
    {
      key: 'DATABASE_URL',
      source: { ...managerSource, DATABASE_URL: 'mysql://db/app' },
    },
    {
      key: 'DATABASE_URL',
      source: { ...managerSource, DATABASE_URL: 'postgresql://db' },
    },
    {
      key: 'LOG_LEVEL',
      source: { ...managerSource, LOG_LEVEL: 'verbose' },
    },
  ];

  for (const scenario of scenarios) {
    expectConfigurationError(
      () => createManagerApiEnvironment(scenario.source),
      scenario.key,
      'INVALID'
    );
  }
});

void test('produção exige valores explícitos para defaults operacionais', () => {
  expectConfigurationError(
    () =>
      createWorkerEnvironment({
        APP_ENVIRONMENT: 'PROD',
        REDIS_URL: 'redis://redis.example.test:6379/0',
      }),
    'LOG_LEVEL',
    'MISSING'
  );

  expectConfigurationError(
    () =>
      createManagerApiEnvironment({
        ...managerSource,
        APP_ENVIRONMENT: 'PROD',
        API_HOST: undefined,
      }),
    'API_HOST',
    'MISSING'
  );
});

void test('produção rejeita credencial de exemplo dentro da URL do banco', () => {
  const placeholder = 'local-postgres-change-before-production';
  expectConfigurationError(
    () =>
      createDatabaseEnvironment({
        APP_ENVIRONMENT: 'PROD',
        DATABASE_URL: `postgresql://user:${placeholder}@db:5432/protege_mais`,
      }),
    'DATABASE_URL',
    'INSECURE',
    placeholder
  );
});

void test('valida configurações isoladas de banco e Redis', () => {
  const database = createDatabaseEnvironment(managerSource);
  const redis = createRedisEnvironment({
    APP_ENVIRONMENT: 'DEV',
    REDIS_URL: 'rediss://redis.example.test:6379/0',
  });

  assert.equal(database.databaseUrl, managerSource.DATABASE_URL);
  assert.equal(redis.redisUrl, 'rediss://redis.example.test:6379/0');
  assert.ok(Object.isFrozen(database));
  assert.ok(Object.isFrozen(redis));

  expectConfigurationError(
    () =>
      createRedisEnvironment({
        APP_ENVIRONMENT: 'DEV',
        REDIS_URL: 'http://redis',
      }),
    'REDIS_URL',
    'INVALID'
  );

  for (const invalidUrl of [
    'redis://redis.example.test/cache',
    'redis://redis.example.test/0?secret=value',
    'redis://redis.example.test/0#fragment',
  ]) {
    expectConfigurationError(
      () =>
        createRedisEnvironment({
          APP_ENVIRONMENT: 'DEV',
          REDIS_URL: invalidUrl,
        }),
      'REDIS_URL',
      'INVALID',
      invalidUrl
    );
  }
});

void test('apps exigem Redis e produção rejeita credencial de exemplo', () => {
  expectConfigurationError(
    () =>
      createManagerApiEnvironment({
        ...managerSource,
        REDIS_URL: undefined,
      }),
    'REDIS_URL',
    'MISSING'
  );

  const placeholder = 'local-redis-change-before-production';
  expectConfigurationError(
    () =>
      createWorkerEnvironment({
        APP_ENVIRONMENT: 'PROD',
        LOG_LEVEL: 'info',
        REDIS_URL: `rediss://default:${placeholder}@redis.example.test:6379/0`,
      }),
    'REDIS_URL',
    'INSECURE',
    placeholder
  );

  expectConfigurationError(
    () =>
      createRedisEnvironment({
        APP_ENVIRONMENT: 'PROD',
        REDIS_URL:
          'rediss://default:change%2Dbefore%2Dproduction@redis.example.test/0',
      }),
    'REDIS_URL',
    'INSECURE'
  );
});

void test('rejeita segredos JWT vazios, iguais e placeholders em produção', () => {
  expectConfigurationError(
    () =>
      createJwtEnvironment({
        APP_ENVIRONMENT: 'DEV',
        JWT_ACCESS_SECRET: '   ',
        JWT_REFRESH_SECRET: 'refresh-secret',
      }),
    'JWT_ACCESS_SECRET',
    'MISSING'
  );

  expectConfigurationError(
    () =>
      createJwtEnvironment({
        APP_ENVIRONMENT: 'DEV',
        JWT_ACCESS_SECRET: 'same-secret',
        JWT_REFRESH_SECRET: 'same-secret',
      }),
    'JWT_REFRESH_SECRET',
    'INVALID'
  );

  const placeholder = 'local-only-change-before-production';
  expectConfigurationError(
    () =>
      createJwtEnvironment({
        APP_ENVIRONMENT: 'PROD',
        JWT_ACCESS_SECRET: placeholder,
        JWT_REFRESH_SECRET: 'production-refresh-value',
      }),
    'JWT_ACCESS_SECRET',
    'INSECURE',
    placeholder
  );
});

void test('rejeita placeholders nos demais segredos de produção', () => {
  const placeholder = 'local-only-change-before-production';

  expectConfigurationError(
    () =>
      createEncryptionEnvironment({
        APP_ENVIRONMENT: 'PROD',
        ENCRYPTION_KEY: placeholder,
      }),
    'ENCRYPTION_KEY',
    'INSECURE',
    placeholder
  );

  expectConfigurationError(
    () =>
      createS3Environment({
        APP_ENVIRONMENT: 'PROD',
        S3_ENDPOINT: 'https://s3.example.test',
        S3_REGION: 'us-east-1',
        S3_BUCKET: 'protege-mais-prod',
        S3_ACCESS_KEY: placeholder,
        S3_SECRET_KEY: 'production-s3-value',
      }),
    'S3_ACCESS_KEY',
    'INSECURE',
    placeholder
  );

  expectConfigurationError(
    () =>
      createSmtpEnvironment({
        APP_ENVIRONMENT: 'PROD',
        SMTP_HOST: 'smtp.example.test',
        SMTP_PORT: '465',
        SMTP_SECURE: 'true',
        SMTP_USER: 'mailer',
        SMTP_PASSWORD: placeholder,
        SMTP_FROM: 'noreply@example.test',
      }),
    'SMTP_PASSWORD',
    'INSECURE',
    placeholder
  );
});

void test('valida e congela configurações de criptografia, S3 e SMTP', () => {
  const encryption = createEncryptionEnvironment({
    APP_ENVIRONMENT: 'DEV',
    ENCRYPTION_KEY: 'development-encryption-key',
  });
  const s3 = createS3Environment({
    APP_ENVIRONMENT: 'DEV',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'us-east-1',
    S3_BUCKET: 'protege-mais',
    S3_ACCESS_KEY: 'local-access',
    S3_SECRET_KEY: 'local-secret',
  });
  const smtp = createSmtpEnvironment({
    APP_ENVIRONMENT: 'DEV',
    SMTP_HOST: 'localhost',
    SMTP_PORT: '1025',
    SMTP_SECURE: 'false',
    SMTP_USER: 'local-user',
    SMTP_PASSWORD: 'local-password',
    SMTP_FROM: 'noreply@example.test',
  });

  assert.equal(encryption.encryptionKey, 'development-encryption-key');
  assert.equal(s3.bucket, 'protege-mais');
  assert.equal(smtp.secure, false);
  assert.ok(Object.isFrozen(encryption));
  assert.ok(Object.isFrozen(s3));
  assert.ok(Object.isFrozen(smtp));
});

void test('rejeita campos inválidos de S3 e SMTP', () => {
  expectConfigurationError(
    () =>
      createS3Environment({
        APP_ENVIRONMENT: 'DEV',
        S3_ENDPOINT: 'http://localhost:9000',
        S3_REGION: 'us-east-1',
        S3_BUCKET: 'Bucket Inválido',
        S3_ACCESS_KEY: 'access',
        S3_SECRET_KEY: 'secret-value',
      }),
    'S3_BUCKET',
    'INVALID'
  );

  expectConfigurationError(
    () =>
      createS3Environment({
        APP_ENVIRONMENT: 'DEV',
        S3_ENDPOINT: 'http://user:password@localhost:9000',
        S3_REGION: 'us-east-1',
        S3_BUCKET: 'protege-mais',
        S3_ACCESS_KEY: 'access',
        S3_SECRET_KEY: 'secret-value',
      }),
    'S3_ENDPOINT',
    'INVALID'
  );

  expectConfigurationError(
    () =>
      createSmtpEnvironment({
        APP_ENVIRONMENT: 'DEV',
        SMTP_HOST: 'localhost',
        SMTP_PORT: '1025',
        SMTP_SECURE: 'yes',
        SMTP_USER: 'local-user',
        SMTP_PASSWORD: 'local-password',
        SMTP_FROM: 'noreply@example.test',
      }),
    'SMTP_SECURE',
    'INVALID'
  );
});

void test('rejeita segredo com espaços sem ecoar o conteúdo', () => {
  const secretValue = ' secret-with-spaces ';
  expectConfigurationError(
    () =>
      createEncryptionEnvironment({
        APP_ENVIRONMENT: 'DEV',
        ENCRYPTION_KEY: secretValue,
      }),
    'ENCRYPTION_KEY',
    'INVALID',
    secretValue
  );
});
