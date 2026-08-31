import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ServiceUnavailableError } from '@protege-mais/common';
import type { LoginRateLimitCounter } from '@protege-mais/interfaces';
import {
  FixedWindowLoginRateLimiter,
  LoginRateLimitExceededError,
} from './index.js';

const rateLimitSecret = 'rate-limit-secret-with-thirty-two-bytes';

class CounterDouble implements LoginRateLimitCounter {
  public readonly keys: string[] = [];
  public readonly ttlValues: number[] = [];
  public value = 0;

  public incrementWithExpiration(key: string, ttlSeconds: number) {
    this.keys.push(key);
    this.ttlValues.push(ttlSeconds);
    this.value += 1;
    return Promise.resolve({ value: this.value, ttlSeconds });
  }
}

void test('limita a janela e nunca envia endereço bruto ao contador', async () => {
  const counter = new CounterDouble();
  const subject = new FixedWindowLoginRateLimiter(counter, rateLimitSecret, {
    maximumAttempts: 2,
    windowSeconds: 30,
  });
  const clientAddress = '203.0.113.42';

  assert.deepEqual(await subject.consume(clientAddress), {
    remainingAttempts: 1,
    retryAfterSeconds: 30,
  });
  assert.deepEqual(await subject.consume(clientAddress), {
    remainingAttempts: 0,
    retryAfterSeconds: 30,
  });
  await assert.rejects(subject.consume(clientAddress), (error: unknown) => {
    assert.ok(error instanceof LoginRateLimitExceededError);
    assert.equal(error.statusCode, 429);
    assert.equal(error.code, 'AUTHENTICATION_RATE_LIMITED');
    assert.equal(error.retryAfterSeconds, 30);
    return true;
  });

  assert.deepEqual(counter.ttlValues, [30, 30, 30]);
  assert.equal(new Set(counter.keys).size, 1);
  assert.match(
    counter.keys[0] ?? '',
    /^rate-limit:authentication:login:[a-f0-9]{64}$/u
  );
  assert.doesNotMatch(counter.keys.join(' '), new RegExp(clientAddress));
});

void test('endereços distintos usam buckets opacos distintos', async () => {
  const counter = new CounterDouble();
  const subject = new FixedWindowLoginRateLimiter(counter, rateLimitSecret);

  await subject.consume('203.0.113.42');
  counter.value = 0;
  await subject.consume('2001:db8::42');

  assert.equal(new Set(counter.keys).size, 2);
});

void test('falha fechada quando o contador está indisponível ou incoerente', async () => {
  const unavailable = new FixedWindowLoginRateLimiter(
    {
      incrementWithExpiration: () =>
        Promise.reject(new Error('diagnóstico Redis secreto')),
    },
    rateLimitSecret
  );
  const inconsistent = new FixedWindowLoginRateLimiter(
    {
      incrementWithExpiration: () =>
        Promise.resolve({ value: 1, ttlSeconds: 0 }),
    },
    rateLimitSecret
  );

  for (const subject of [unavailable, inconsistent]) {
    await assert.rejects(subject.consume('203.0.113.42'), (error: unknown) => {
      assert.ok(error instanceof ServiceUnavailableError);
      assert.equal(error.code, 'AUTHENTICATION_UNAVAILABLE');
      assert.doesNotMatch(
        JSON.stringify(error),
        /Redis|diagnóstico|203\.0\.113/u
      );
      return true;
    });
  }
});

void test('rejeita configuração insegura do limitador', () => {
  const counter = new CounterDouble();

  assert.throws(
    () => new FixedWindowLoginRateLimiter(counter, 'short-secret'),
    RangeError
  );
  assert.throws(
    () =>
      new FixedWindowLoginRateLimiter(counter, rateLimitSecret, {
        maximumAttempts: 0,
      }),
    RangeError
  );
});
