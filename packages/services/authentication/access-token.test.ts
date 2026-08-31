import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SignJWT, decodeJwt, decodeProtectedHeader } from 'jose';
import { isUuidV7 } from '@protege-mais/common';
import {
  InvalidAccessTokenError,
  JoseAccessTokenService,
  UuidV7AuthenticationSessionIdGenerator,
  accessTokenAlgorithm,
  accessTokenAudience,
  accessTokenIssuer,
  accessTokenLifetimeSeconds,
  accessTokenPurpose,
  accessTokenTypeHeader,
} from './access-token.js';

const accessSecret = 'access-secret-with-at-least-thirty-two-bytes';
const otherAccessSecret = 'other-secret-with-at-least-thirty-two-bytes';
const accountId = '01994b90-8100-7000-8000-000000000023';
const sessionId = '01994b90-8100-7000-8000-000000000024';
const issuedAt = new Date('2026-08-31T12:00:00.000Z');

async function createTokenWithContext(input: {
  readonly audience?: string;
  readonly issuer?: string;
  readonly purpose?: string;
}) {
  const issuedAtSeconds = Math.floor(issuedAt.getTime() / 1_000);

  return new SignJWT({
    sid: sessionId,
    token_use: input.purpose ?? accessTokenPurpose,
  })
    .setProtectedHeader({
      alg: accessTokenAlgorithm,
      typ: accessTokenTypeHeader,
    })
    .setSubject(accountId)
    .setIssuer(input.issuer ?? accessTokenIssuer)
    .setAudience(input.audience ?? accessTokenAudience)
    .setIssuedAt(issuedAtSeconds)
    .setExpirationTime(issuedAtSeconds + accessTokenLifetimeSeconds)
    .sign(new TextEncoder().encode(accessSecret));
}

void test('assina e verifica access token curto com claims mínimas', async () => {
  const service = new JoseAccessTokenService(accessSecret);
  const issued = await service.issue({ accountId, sessionId, issuedAt });
  const verified = await service.verify(
    issued.token,
    new Date('2026-08-31T12:05:00.000Z')
  );
  const header = decodeProtectedHeader(issued.token);
  const payload = decodeJwt(issued.token);

  assert.equal(issued.expiresInSeconds, accessTokenLifetimeSeconds);
  assert.deepEqual(header, {
    alg: accessTokenAlgorithm,
    typ: accessTokenTypeHeader,
  });
  assert.deepEqual(Object.keys(payload).sort(), [
    'aud',
    'exp',
    'iat',
    'iss',
    'sid',
    'sub',
    'token_use',
  ]);
  assert.equal(payload.sub, accountId);
  assert.equal(payload.sid, sessionId);
  assert.equal(payload.iss, accessTokenIssuer);
  assert.equal(payload.aud, accessTokenAudience);
  assert.equal(payload.token_use, accessTokenPurpose);
  assert.equal(payload.exp, (payload.iat ?? 0) + accessTokenLifetimeSeconds);
  assert.deepEqual(verified, {
    accountId,
    sessionId,
    issuedAt,
    expiresAt: new Date('2026-08-31T12:15:00.000Z'),
  });
  assert.equal(Object.isFrozen(issued), true);
  assert.equal(Object.isFrozen(verified), true);

  const serializedPayload = JSON.stringify(payload);
  assert.doesNotMatch(
    serializedPayload,
    /email|password|phone|organization|permission|role|secret/iu
  );
});

void test('rejeita expiração, alteração e assinatura com outra chave', async () => {
  const service = new JoseAccessTokenService(accessSecret);
  const otherService = new JoseAccessTokenService(otherAccessSecret);
  const issued = await service.issue({ accountId, sessionId, issuedAt });
  const parts = issued.token.split('.');
  const payload = parts[1] ?? '';
  const changedPayload = `${payload.startsWith('a') ? 'b' : 'a'}${payload.slice(1)}`;
  const changedToken = [parts[0], changedPayload, parts[2]].join('.');

  await assert.rejects(
    service.verify(issued.token, new Date('2026-08-31T12:15:00.000Z')),
    InvalidAccessTokenError
  );
  await assert.rejects(
    service.verify(changedToken, new Date('2026-08-31T12:05:00.000Z')),
    InvalidAccessTokenError
  );
  await assert.rejects(
    otherService.verify(issued.token, new Date('2026-08-31T12:05:00.000Z')),
    InvalidAccessTokenError
  );
});

void test('rejeita issuer, audience e finalidade incorretos', async () => {
  const service = new JoseAccessTokenService(accessSecret);
  const tokens = await Promise.all([
    createTokenWithContext({ issuer: 'urn:protege-mais:other-issuer' }),
    createTokenWithContext({ audience: 'urn:protege-mais:other-api' }),
    createTokenWithContext({ purpose: 'refresh' }),
  ]);

  for (const token of tokens) {
    await assert.rejects(
      service.verify(token, new Date('2026-08-31T12:05:00.000Z')),
      InvalidAccessTokenError
    );
  }
});

void test('valida material da chave e identificadores de emissão', async () => {
  assert.throws(() => new JoseAccessTokenService('short-secret'), RangeError);

  const service = new JoseAccessTokenService(accessSecret);
  await assert.rejects(
    service.issue({ accountId: 'invalid-account', sessionId, issuedAt }),
    RangeError
  );
  await assert.rejects(
    service.issue({ accountId, sessionId: 'invalid-session', issuedAt }),
    RangeError
  );
});

void test('gera identificador UUID v7 para a sessão lógica do token', () => {
  const generated = new UuidV7AuthenticationSessionIdGenerator().generate();

  assert.equal(isUuidV7(generated), true);
});
