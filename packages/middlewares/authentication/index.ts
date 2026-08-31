import { createHmac } from 'node:crypto';
import {
  ServiceUnavailableError,
  TooManyRequestsError,
} from '@protege-mais/common';
import type {
  LoginRateLimitConsumption,
  LoginRateLimitCounter,
  LoginRateLimiter,
} from '@protege-mais/interfaces';

export const loginRateLimitMaximumAttempts = 5;
export const loginRateLimitWindowSeconds = 60;

const rateLimitKeyPrefix = 'rate-limit:authentication:login:';
const rateLimitSecretMinimumBytes = 32;
const clientAddressMaximumLength = 255;

export interface FixedWindowLoginRateLimiterOptions {
  readonly maximumAttempts?: number;
  readonly windowSeconds?: number;
}

export class LoginRateLimitExceededError extends TooManyRequestsError {
  public readonly retryAfterSeconds: number;

  public constructor(retryAfterSeconds: number) {
    super({
      code: 'AUTHENTICATION_RATE_LIMITED',
      message: 'Muitas tentativas de autenticação foram realizadas.',
      messageKey: 'authentication.rateLimited',
    });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} deve ser um inteiro positivo.`);
  }

  return value;
}

function normalizedClientAddress(clientAddress: string): string {
  const normalized = clientAddress.trim();

  if (
    normalized.length === 0 ||
    normalized.length > clientAddressMaximumLength ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    return 'unavailable';
  }

  return normalized;
}

function opaqueRateLimitKey(clientAddress: string, secret: string): string {
  const digest = createHmac('sha256', secret)
    .update('protege-mais:login-rate-limit:v1\0', 'utf8')
    .update(normalizedClientAddress(clientAddress), 'utf8')
    .digest('hex');

  return `${rateLimitKeyPrefix}${digest}`;
}

export class FixedWindowLoginRateLimiter implements LoginRateLimiter {
  readonly #maximumAttempts: number;
  readonly #rateLimitSecret: string;
  readonly #windowSeconds: number;

  public constructor(
    private readonly counter: LoginRateLimitCounter,
    rateLimitSecret: string,
    options: FixedWindowLoginRateLimiterOptions = {}
  ) {
    if (
      new TextEncoder().encode(rateLimitSecret).byteLength <
      rateLimitSecretMinimumBytes
    ) {
      throw new RangeError('O segredo do rate limit é insuficiente.');
    }

    this.#rateLimitSecret = rateLimitSecret;
    this.#maximumAttempts = positiveInteger(
      options.maximumAttempts ?? loginRateLimitMaximumAttempts,
      'O limite de tentativas'
    );
    this.#windowSeconds = positiveInteger(
      options.windowSeconds ?? loginRateLimitWindowSeconds,
      'A janela do rate limit'
    );
  }

  public async consume(
    clientAddress: string
  ): Promise<LoginRateLimitConsumption> {
    let increment;

    try {
      increment = await this.counter.incrementWithExpiration(
        opaqueRateLimitKey(clientAddress, this.#rateLimitSecret),
        this.#windowSeconds
      );
    } catch (cause) {
      throw new ServiceUnavailableError({
        cause,
        code: 'AUTHENTICATION_UNAVAILABLE',
        message: 'A autenticação está temporariamente indisponível.',
        messageKey: 'authentication.unavailable',
      });
    }

    if (
      !Number.isSafeInteger(increment.value) ||
      increment.value < 1 ||
      !Number.isSafeInteger(increment.ttlSeconds) ||
      increment.ttlSeconds < 1 ||
      increment.ttlSeconds > this.#windowSeconds
    ) {
      throw new ServiceUnavailableError({
        code: 'AUTHENTICATION_UNAVAILABLE',
        message: 'A autenticação está temporariamente indisponível.',
        messageKey: 'authentication.unavailable',
      });
    }

    if (increment.value > this.#maximumAttempts) {
      throw new LoginRateLimitExceededError(increment.ttlSeconds);
    }

    return Object.freeze({
      remainingAttempts: this.#maximumAttempts - increment.value,
      retryAfterSeconds: increment.ttlSeconds,
    });
  }
}
