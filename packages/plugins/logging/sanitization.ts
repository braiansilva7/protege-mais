export const redactedLogValue = '[REDACTED]';
export const unserializableLogValue = '[UNSERIALIZABLE]';
export const circularLogValue = '[CIRCULAR]';
export const truncatedLogValue = '[TRUNCATED]';

const maximumDepth = 8;
const maximumEntries = 100;

const sensitiveKeyFragments = [
  'accesstoken',
  'address',
  'apikey',
  'authorization',
  'body',
  'cookie',
  'coordinate',
  'cpf',
  'credential',
  'email',
  'encryptionkey',
  'endereco',
  'evidence',
  'file',
  'geolocation',
  'header',
  'latitude',
  'location',
  'logradouro',
  'longitude',
  'medicaldata',
  'narrative',
  'objectkey',
  'params',
  'password',
  'payload',
  'phone',
  'privatekey',
  'pushtoken',
  'query',
  'refreshtoken',
  'relato',
  'report',
  'secret',
  'senha',
  'signedurl',
  'street',
  'telefone',
  'token',
  'url',
] as const;

const protectedContextKeys = new Set([
  'accountid',
  'alertid',
  'caseid',
  'organizationid',
  'organizationunitid',
  'userid',
  'victimid',
]);

const pinoRedactionKeys = [
  'accessToken',
  'address',
  'apiKey',
  'authorization',
  'body',
  'cookie',
  'coordinates',
  'cpf',
  'credentials',
  'email',
  'encryptionKey',
  'endereco',
  'evidence',
  'file',
  'headers',
  'latitude',
  'location',
  'longitude',
  'objectKey',
  'params',
  'password',
  'payload',
  'phone',
  'privateKey',
  'pushToken',
  'query',
  'querystring',
  'refreshToken',
  'relato',
  'secret',
  'senha',
  'signedUrl',
  'telefone',
  'token',
  'url',
] as const;

export const pinoRedactionPaths = pinoRedactionKeys.flatMap((key) => [
  key,
  `*.${key}`,
  `*.*.${key}`,
]);

function normalizeKey(key: string) {
  return key
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

export function isSensitiveLogKey(key: string) {
  const normalized = normalizeKey(key);
  return (
    protectedContextKeys.has(normalized) ||
    sensitiveKeyFragments.some((fragment) => normalized.includes(fragment))
  );
}

function sanitizeString(value: string) {
  return value
    .replace(/\bBearer\s+[^\s,;]+/gi, `Bearer ${redactedLogValue}`)
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      redactedLogValue
    )
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, redactedLogValue)
    .replace(
      /(^|[^\d])-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}(?=$|[^\d])/g,
      `$1${redactedLogValue}`
    );
}

function errorType(value: unknown) {
  try {
    if (
      value instanceof Error &&
      /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u.test(value.name)
    ) {
      return sanitizeString(value.name);
    }

    if (typeof value === 'object' && value !== null) {
      const type = (value as Record<string, unknown>).type;
      if (
        typeof type === 'string' &&
        /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u.test(type)
      ) {
        return sanitizeString(type);
      }
    }
  } catch {
    return 'Error';
  }

  return 'Error';
}

export function safeErrorSerializer(value: unknown) {
  return { type: errorType(value) };
}

function sanitizeObject(
  value: object,
  seen: WeakSet<object>,
  depth: number
): unknown {
  if (value instanceof Error) return safeErrorSerializer(value);
  if (value instanceof Date) {
    try {
      return value.toISOString();
    } catch {
      return unserializableLogValue;
    }
  }
  if (Buffer.isBuffer(value)) return '[BINARY]';
  if (depth >= maximumDepth) return truncatedLogValue;
  if (seen.has(value)) return circularLogValue;

  seen.add(value);

  if (Array.isArray(value)) {
    const result = value
      .slice(0, maximumEntries)
      .map((item) => sanitizeLogValueInternal(item, seen, depth + 1));
    if (value.length > maximumEntries) result.push(truncatedLogValue);
    return result;
  }

  const result: Record<string, unknown> = {};
  const keys = Object.keys(value);

  for (const key of keys.slice(0, maximumEntries)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    if (isSensitiveLogKey(key)) {
      result[key] = redactedLogValue;
      continue;
    }

    try {
      result[key] = sanitizeLogValueInternal(
        (value as Record<string, unknown>)[key],
        seen,
        depth + 1
      );
    } catch {
      result[key] = unserializableLogValue;
    }
  }

  if (keys.length > maximumEntries) result.truncated = truncatedLogValue;
  return result;
}

function sanitizeLogValueInternal(
  value: unknown,
  seen: WeakSet<object>,
  depth: number
): unknown {
  switch (typeof value) {
    case 'string':
      return sanitizeString(value);
    case 'bigint':
      return value.toString();
    case 'function':
      return '[FUNCTION]';
    case 'symbol':
      return '[SYMBOL]';
    case 'number':
      return Number.isFinite(value) ? value : '[NON_FINITE_NUMBER]';
    case 'object':
      if (value === null) return null;
      return sanitizeObject(value, seen, depth);
    default:
      return value;
  }
}

export function sanitizeLogValue(value: unknown): unknown {
  try {
    return sanitizeLogValueInternal(value, new WeakSet(), 0);
  } catch {
    return unserializableLogValue;
  }
}
