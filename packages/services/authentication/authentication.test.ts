import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';
import argon2 from 'argon2';
import {
  Argon2idPasswordHashService,
  StructuredAuthenticationAudit,
  SystemAuthenticationClock,
  argon2idPasswordHashParameters,
  authenticationDummyPasswordHash,
} from './index.js';

const validPassword = 'frase segura para PROT-022';

void test('Argon2id gera salt único e parâmetros versionados', async () => {
  const service = new Argon2idPasswordHashService();
  const firstHash = await service.hash(validPassword);
  const secondHash = await service.hash(validPassword);

  assert.notEqual(firstHash, secondHash);
  assert.match(firstHash, /^\$argon2id\$v=19\$m=19456,p=1,t=2\$/u);
  assert.equal(
    Buffer.from(firstHash.split('$')[4] ?? '', 'base64').byteLength,
    16
  );
  assert.equal(service.needsRehash(firstHash), false);
  assert.equal(await service.verify(validPassword, firstHash), true);
  assert.equal(
    await service.verify('senha incorreta e longa', firstHash),
    false
  );
});

void test('verifica a senha inteira em NFC sem trim ou truncamento', async () => {
  const service = new Argon2idPasswordHashService();
  const hash = await service.hash('Senha Á longa e segura');

  assert.equal(await service.verify('Senha Á longa e segura', hash), true);
  assert.equal(await service.verify(' Senha Á longa e segura', hash), false);
  assert.equal(await service.verify('Senha Á longa e segura ', hash), false);
});

void test('rejeita criação fora da política sem refletir a senha', async () => {
  const service = new Argon2idPasswordHashService();

  await assert.rejects(service.hash('curta'), (error: unknown) => {
    assert.ok(error instanceof RangeError);
    assert.doesNotMatch(error.message, /curta/u);
    return true;
  });
});

void test('credencial ausente, malformada e excessiva falha de modo fechado', async () => {
  const service = new Argon2idPasswordHashService();

  assert.equal(await service.verify(validPassword, null), false);
  assert.equal(await service.verify(validPassword, 'hash-inválido'), false);
  assert.equal(
    await service.verify('A'.repeat(129), authenticationDummyPasswordHash),
    false
  );
  assert.equal(service.needsRehash('hash-inválido'), true);
});

void test('detecta custo Argon2id anterior para rehash futuro', async () => {
  const service = new Argon2idPasswordHashService();
  const weakerHash = await argon2.hash(validPassword, {
    ...argon2idPasswordHashParameters,
    memoryCost: 12_288,
  });

  assert.equal(service.needsRehash(weakerHash), true);
});

void test('caminhos ausente e incorreto executam custo Argon2id comparável', async () => {
  const service = new Argon2idPasswordHashService();
  const validHash = await service.hash(validPassword);

  const measure = async (hash: string | null) => {
    const startedAt = performance.now();
    await service.verify('tentativa incorreta longa', hash);
    return performance.now() - startedAt;
  };
  const missingDurations = await Promise.all([
    measure(null),
    measure(null),
    measure(null),
  ]);
  const wrongDurations = await Promise.all([
    measure(validHash),
    measure(validHash),
    measure(validHash),
  ]);
  const average = (values: readonly number[]) =>
    values.reduce((total, value) => total + value, 0) / values.length;
  const missingAverage = average(missingDurations);
  const wrongAverage = average(wrongDurations);
  const ratio =
    Math.max(missingAverage, wrongAverage) /
    Math.min(missingAverage, wrongAverage);

  assert.equal(missingAverage > 5, true);
  assert.equal(wrongAverage > 5, true);
  assert.equal(ratio < 3, true);
});

void test('auditoria emite somente evento estável e nenhum contexto pessoal', () => {
  const records: Readonly<Record<string, unknown>>[] = [];
  const messages: string[] = [];
  const logger = {
    info: (context: Readonly<Record<string, unknown>>, message: string) => {
      records.push(context);
      messages.push(message);
    },
    warn: (context: Readonly<Record<string, unknown>>, message: string) => {
      records.push(context);
      messages.push(message);
    },
  };
  const audit = new StructuredAuthenticationAudit(logger);

  audit.recordSuccess();
  audit.recordFailure();

  assert.deepEqual(records, [
    { event: 'authentication.succeeded' },
    { event: 'authentication.failed' },
  ]);
  assert.deepEqual(
    records.flatMap((record) => Object.keys(record)),
    ['event', 'event']
  );
  assert.doesNotMatch(messages.join(' '), /email|senha|conta|hash|status/iu);
});

void test('relógio de autenticação entrega instante válido', () => {
  const before = Date.now();
  const now = new SystemAuthenticationClock().now();
  const after = Date.now();

  assert.equal(now.getTime() >= before, true);
  assert.equal(now.getTime() <= after, true);
});
