import { isIP } from 'node:net';

export const APP_ENVIRONMENTS = ['LOCAL', 'DEV', 'HMG', 'PROD'] as const;
export const LOG_LEVELS = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'silent',
] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];
export type LogLevel = (typeof LOG_LEVELS)[number];
export type EnvironmentSource = Readonly<Record<string, string | undefined>>;
export type ConfigurationErrorReason = 'MISSING' | 'INVALID' | 'INSECURE';

export interface ManagerApiEnvironment {
  readonly appEnvironment: AppEnvironment;
  readonly host: string;
  readonly port: number;
  readonly corsOrigins: readonly string[];
  readonly databaseUrl: string;
  readonly logLevel: LogLevel;
}

export interface WorkerEnvironment {
  readonly appEnvironment: AppEnvironment;
  readonly logLevel: LogLevel;
}

export interface ClientEnvironment {
  readonly appEnvironment: AppEnvironment;
  readonly apiUrl: string;
}

export interface DatabaseEnvironment {
  readonly appEnvironment: AppEnvironment;
  readonly databaseUrl: string;
}

export interface RedisEnvironment {
  readonly appEnvironment: AppEnvironment;
  readonly redisUrl: string;
}

export interface JwtEnvironment {
  readonly appEnvironment: AppEnvironment;
  readonly accessSecret: string;
  readonly refreshSecret: string;
}

export interface EncryptionEnvironment {
  readonly appEnvironment: AppEnvironment;
  readonly encryptionKey: string;
}

export interface S3Environment {
  readonly appEnvironment: AppEnvironment;
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKey: string;
  readonly secretKey: string;
}

export interface SmtpEnvironment {
  readonly appEnvironment: AppEnvironment;
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly user: string;
  readonly password: string;
  readonly from: string;
}

const unsafeProductionSecrets = new Set([
  'admin',
  'adminadmin',
  'change-me',
  'dev-only',
  'local-only',
  'password',
  'replace-me',
  'secret',
  'troque-me',
]);

const errorReasonLabel: Readonly<Record<ConfigurationErrorReason, string>> =
  Object.freeze({
    MISSING: 'ausente',
    INVALID: 'inválida',
    INSECURE: 'insegura para produção',
  });

export class ConfigurationError extends Error {
  readonly keys: readonly string[];
  readonly reason: ConfigurationErrorReason;

  constructor(
    keys: string | readonly string[],
    reason: ConfigurationErrorReason
  ) {
    const normalizedKeys = Object.freeze(
      typeof keys === 'string' ? [keys] : [...keys]
    );
    super(
      `Configuração ${errorReasonLabel[reason]}: ${normalizedKeys.join(', ')}.`
    );
    this.name = 'ConfigurationError';
    this.keys = normalizedKeys;
    this.reason = reason;
  }
}

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function optional(source: EnvironmentSource, key: string): string | undefined {
  const rawValue = source[key];
  if (typeof rawValue !== 'string') return undefined;

  const value = rawValue.trim();
  return value.length > 0 ? value : undefined;
}

function required(source: EnvironmentSource, key: string): string {
  const value = optional(source, key);
  if (!value) throw new ConfigurationError(key, 'MISSING');
  return value;
}

function appEnvironment(
  source: EnvironmentSource,
  key = 'APP_ENVIRONMENT'
): AppEnvironment {
  const value = required(source, key).toUpperCase();
  if (!APP_ENVIRONMENTS.some((environment) => environment === value)) {
    throw new ConfigurationError(key, 'INVALID');
  }
  return value as AppEnvironment;
}

function withNonProductionDefault(
  source: EnvironmentSource,
  key: string,
  environment: AppEnvironment,
  fallback: string
): string {
  const value = optional(source, key);
  if (value) return value;
  if (environment === 'PROD') throw new ConfigurationError(key, 'MISSING');
  return fallback;
}

function port(value: string, key: string): number {
  if (!/^\d+$/.test(value)) throw new ConfigurationError(key, 'INVALID');

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new ConfigurationError(key, 'INVALID');
  }
  return parsed;
}

function host(value: string, key: string): string {
  if (
    value.includes('://') ||
    value.includes('/') ||
    value.includes('?') ||
    value.includes('#') ||
    /\s/.test(value)
  ) {
    throw new ConfigurationError(key, 'INVALID');
  }

  if (isIP(value) === 0) {
    const labels = value.split('.');
    if (
      value.length > 253 ||
      labels.some(
        (label) =>
          label.length === 0 ||
          label.length > 63 ||
          !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
      )
    ) {
      throw new ConfigurationError(key, 'INVALID');
    }
  }
  return value;
}

function parsedUrl(
  value: string,
  key: string,
  protocols: readonly string[]
): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ConfigurationError(key, 'INVALID');
  }

  if (!protocols.includes(parsed.protocol) || !parsed.hostname) {
    throw new ConfigurationError(key, 'INVALID');
  }
  return parsed;
}

function serviceUrl(
  source: EnvironmentSource,
  key: string,
  protocols: readonly string[]
): string {
  const value = required(source, key);
  parsedUrl(value, key, protocols);
  return value;
}

function isUnsafeProductionSecret(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    unsafeProductionSecrets.has(normalized) ||
    normalized.includes('change-before-production') ||
    normalized.includes('troque-por') ||
    /^(?:<.*>|\[.*\])$/.test(normalized)
  );
}

function databaseUrl(
  source: EnvironmentSource,
  environment: AppEnvironment
): string {
  const value = required(source, 'DATABASE_URL');
  const parsed = parsedUrl(value, 'DATABASE_URL', ['postgres:', 'postgresql:']);
  if (parsed.pathname === '' || parsed.pathname === '/') {
    throw new ConfigurationError('DATABASE_URL', 'INVALID');
  }
  if (
    environment === 'PROD' &&
    parsed.password &&
    isUnsafeProductionSecret(parsed.password)
  ) {
    throw new ConfigurationError('DATABASE_URL', 'INSECURE');
  }
  return value;
}

function publicHttpUrl(source: EnvironmentSource, key: string): string {
  const value = required(source, key);
  const parsed = parsedUrl(value, key, ['http:', 'https:']);
  if (parsed.username || parsed.password) {
    throw new ConfigurationError(key, 'INVALID');
  }
  return value;
}

function origins(source: EnvironmentSource, key: string): readonly string[] {
  const values = required(source, key)
    .split(',')
    .map((value) => value.trim());

  if (values.some((value) => value.length === 0)) {
    throw new ConfigurationError(key, 'INVALID');
  }

  const normalized = values.map((value) => {
    const parsed = parsedUrl(value, key, ['http:', 'https:']);
    if (
      parsed.username ||
      parsed.password ||
      (parsed.pathname !== '' && parsed.pathname !== '/') ||
      parsed.search ||
      parsed.hash
    ) {
      throw new ConfigurationError(key, 'INVALID');
    }
    return parsed.origin;
  });

  return Object.freeze([...new Set(normalized)]);
}

function logLevel(
  source: EnvironmentSource,
  environment: AppEnvironment
): LogLevel {
  const value = withNonProductionDefault(
    source,
    'LOG_LEVEL',
    environment,
    'info'
  ).toLowerCase();

  if (!LOG_LEVELS.some((level) => level === value)) {
    throw new ConfigurationError('LOG_LEVEL', 'INVALID');
  }
  return value as LogLevel;
}

function secret(
  source: EnvironmentSource,
  key: string,
  environment: AppEnvironment
): string {
  const rawValue = source[key];
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    throw new ConfigurationError(key, 'MISSING');
  }
  if (rawValue !== rawValue.trim()) {
    throw new ConfigurationError(key, 'INVALID');
  }

  if (environment === 'PROD' && isUnsafeProductionSecret(rawValue)) {
    throw new ConfigurationError(key, 'INSECURE');
  }
  return rawValue;
}

function boolean(source: EnvironmentSource, key: string): boolean {
  const value = required(source, key).toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new ConfigurationError(key, 'INVALID');
}

function email(source: EnvironmentSource, key: string): string {
  const value = required(source, key);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new ConfigurationError(key, 'INVALID');
  }
  return value;
}

export function createManagerApiEnvironment(
  source: EnvironmentSource
): ManagerApiEnvironment {
  const environment = appEnvironment(source);
  const result: ManagerApiEnvironment = {
    appEnvironment: environment,
    host: host(
      withNonProductionDefault(source, 'API_HOST', environment, '127.0.0.1'),
      'API_HOST'
    ),
    port: port(
      withNonProductionDefault(source, 'API_PORT', environment, '3000'),
      'API_PORT'
    ),
    corsOrigins: origins(source, 'CORS_ORIGIN'),
    databaseUrl: databaseUrl(source, environment),
    logLevel: logLevel(source, environment),
  };
  return freeze(result);
}

export function createWorkerEnvironment(
  source: EnvironmentSource
): WorkerEnvironment {
  const environment = appEnvironment(source);
  return freeze({
    appEnvironment: environment,
    logLevel: logLevel(source, environment),
  });
}

export function createWebEnvironment(
  source: EnvironmentSource
): ClientEnvironment {
  return freeze({
    appEnvironment: appEnvironment(source, 'VITE_APP_ENVIRONMENT'),
    apiUrl: publicHttpUrl(source, 'VITE_API_URL'),
  });
}

export function createMobileEnvironment(
  source: EnvironmentSource
): ClientEnvironment {
  return freeze({
    appEnvironment: appEnvironment(source, 'EXPO_PUBLIC_APP_ENVIRONMENT'),
    apiUrl: publicHttpUrl(source, 'EXPO_PUBLIC_API_URL'),
  });
}

export function createDatabaseEnvironment(
  source: EnvironmentSource
): DatabaseEnvironment {
  const environment = appEnvironment(source);
  return freeze({
    appEnvironment: environment,
    databaseUrl: databaseUrl(source, environment),
  });
}

export function createRedisEnvironment(
  source: EnvironmentSource
): RedisEnvironment {
  return freeze({
    appEnvironment: appEnvironment(source),
    redisUrl: serviceUrl(source, 'REDIS_URL', ['redis:', 'rediss:']),
  });
}

export function createJwtEnvironment(
  source: EnvironmentSource
): JwtEnvironment {
  const environment = appEnvironment(source);
  const accessSecret = secret(source, 'JWT_ACCESS_SECRET', environment);
  const refreshSecret = secret(source, 'JWT_REFRESH_SECRET', environment);
  if (accessSecret === refreshSecret) {
    throw new ConfigurationError(
      ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'],
      'INVALID'
    );
  }

  return freeze({
    appEnvironment: environment,
    accessSecret,
    refreshSecret,
  });
}

export function createEncryptionEnvironment(
  source: EnvironmentSource
): EncryptionEnvironment {
  const environment = appEnvironment(source);
  return freeze({
    appEnvironment: environment,
    encryptionKey: secret(source, 'ENCRYPTION_KEY', environment),
  });
}

export function createS3Environment(source: EnvironmentSource): S3Environment {
  const environment = appEnvironment(source);
  const bucket = required(source, 'S3_BUCKET');
  if (
    !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) ||
    bucket.includes('..')
  ) {
    throw new ConfigurationError('S3_BUCKET', 'INVALID');
  }
  const region = required(source, 'S3_REGION');
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(region)) {
    throw new ConfigurationError('S3_REGION', 'INVALID');
  }

  return freeze({
    appEnvironment: environment,
    endpoint: publicHttpUrl(source, 'S3_ENDPOINT'),
    region,
    bucket,
    accessKey: secret(source, 'S3_ACCESS_KEY', environment),
    secretKey: secret(source, 'S3_SECRET_KEY', environment),
  });
}

export function createSmtpEnvironment(
  source: EnvironmentSource
): SmtpEnvironment {
  const environment = appEnvironment(source);
  return freeze({
    appEnvironment: environment,
    host: host(required(source, 'SMTP_HOST'), 'SMTP_HOST'),
    port: port(required(source, 'SMTP_PORT'), 'SMTP_PORT'),
    secure: boolean(source, 'SMTP_SECURE'),
    user: required(source, 'SMTP_USER'),
    password: secret(source, 'SMTP_PASSWORD', environment),
    from: email(source, 'SMTP_FROM'),
  });
}
