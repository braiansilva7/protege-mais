import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeJwt, decodeProtectedHeader } from 'jose';
import {
  JoseRefreshTokenService,
  Sha256RefreshTokenHashService,
  refreshTokenAlgorithm,
  refreshTokenAudience,
  refreshTokenHashPrefix,
  refreshTokenLifetimeSeconds,
  refreshTokenPurpose,
  refreshTokenTypeHeader,
} from './refresh-token.js';
import { accessTokenIssuer, JoseAccessTokenService } from './access-token.js';

const refreshSecret = 'refresh-secret-with-at-least-thirty-two-bytes';
const otherRefreshSecret =
  'other-refresh-secret-with-at-least-thirty-two-bytes';
const accountId = '01994b90-8100-7000-8000-000000000023';
const sessionId = '01994b90-8100-7000-8000-000000000024';
const issuedAt = new Date('2026-08-31T12:00:00.000Z');

void test('emite refresh JWT mínimo, aleatório e válido por trinta dias', async () => {
  const service = new JoseRefreshTokenService(refreshSecret);
  const first = await service.issue({ accountId, sessionId, issuedAt });
  const second = await service.issue({ accountId, sessionId, issuedAt });
  const verified = await service.verify(
    first.token,
    new Date('2026-09-01T12:00:00.000Z')
  );
  const header = decodeProtectedHeader(first.token);
  const payload = decodeJwt(first.token);

  assert.notEqual(first.token, second.token);
  assert.equal(first.expiresInSeconds, refreshTokenLifetimeSeconds);
  assert.equal(
    first.expiresAt.getTime(),
    issuedAt.getTime() + refreshTokenLifetimeSeconds * 1_000
  );
  assert.deepEqual(header, {
    alg: refreshTokenAlgorithm,
    typ: refreshTokenTypeHeader,
  });
  assert.deepEqual(Object.keys(payload).sort(), [
    'aud',
    'exp',
    'iat',
    'iss',
    'jti',
    'sid',
    'sub',
    'token_use',
  ]);
  assert.equal(payload.sub, accountId);
  assert.equal(payload.sid, sessionId);
  assert.equal(payload.iss, accessTokenIssuer);
  assert.equal(payload.aud, refreshTokenAudience);
  assert.equal(payload.token_use, refreshTokenPurpose);
  assert.match(payload.jti ?? '', /^[A-Za-z0-9_-]{43}$/u);
  assert.deepEqual(verified, {
    accountId,
    sessionId,
    tokenId: payload.jti,
    issuedAt,
    expiresAt: first.expiresAt,
  });
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(verified), true);
  assert.doesNotMatch(
    JSON.stringify(payload),
    /email|password|phone|device|organization|permission|role|secret/iu
  );
});

void test('rotação preserva expiração absoluta e reduz o tempo restante', async () => {
  const service = new JoseRefreshTokenService(refreshSecret);
  const initial = await service.issue({ accountId, sessionId, issuedAt });
  const rotatedAt = new Date('2026-09-01T12:00:00.000Z');
  const rotated = await service.issue({
    accountId,
    sessionId,
    issuedAt: rotatedAt,
    expiresAt: initial.expiresAt,
  });
  const verified = await service.verify(rotated.token, rotatedAt);

  assert.equal(rotated.expiresAt.getTime(), initial.expiresAt.getTime());
  assert.equal(
    rotated.expiresInSeconds,
    refreshTokenLifetimeSeconds - 24 * 60 * 60
  );
  assert.equal(verified?.sessionId, sessionId);
  assert.equal(verified?.expiresAt.getTime(), initial.expiresAt.getTime());
});

void test('rejeita expiração, alteração, chave distinta e tipo de credencial incorreto', async () => {
  const service = new JoseRefreshTokenService(refreshSecret);
  const otherService = new JoseRefreshTokenService(otherRefreshSecret);
  const issued = await service.issue({ accountId, sessionId, issuedAt });
  const accessToken = await new JoseAccessTokenService(refreshSecret).issue({
    accountId,
    sessionId,
    issuedAt,
  });
  const parts = issued.token.split('.');
  const payload = parts[1] ?? '';
  const changedPayload = `${payload.startsWith('a') ? 'b' : 'a'}${payload.slice(1)}`;
  const changedToken = [parts[0], changedPayload, parts[2]].join('.');

  assert.equal(await service.verify(issued.token, issued.expiresAt), null);
  assert.equal(
    await otherService.verify(
      issued.token,
      new Date('2026-09-01T12:00:00.000Z')
    ),
    null
  );
  assert.equal(
    await service.verify(changedToken, new Date('2026-09-01T12:00:00.000Z')),
    null
  );
  assert.equal(
    await service.verify(
      accessToken.token,
      new Date('2026-08-31T12:01:00.000Z')
    ),
    null
  );
  assert.equal(await service.verify('', issuedAt), null);
});

void test('valida a chave, os identificadores e a validade da emissão', async () => {
  assert.throws(() => new JoseRefreshTokenService('short-secret'), RangeError);
  const service = new JoseRefreshTokenService(refreshSecret);

  await assert.rejects(
    service.issue({ accountId: 'invalid', sessionId, issuedAt }),
    RangeError
  );
  await assert.rejects(
    service.issue({
      accountId,
      sessionId,
      issuedAt,
      expiresAt: new Date(issuedAt.getTime() - 1),
    }),
    RangeError
  );
  await assert.rejects(
    service.issue({
      accountId,
      sessionId,
      issuedAt,
      expiresAt: new Date(
        issuedAt.getTime() + (refreshTokenLifetimeSeconds + 1) * 1_000
      ),
    }),
    RangeError
  );
});

void test('hash SHA-256 é determinístico, opaco e nunca contém o token', () => {
  const service = new Sha256RefreshTokenHashService();
  const token = 'refresh-token-random-value-prot-024';
  const first = service.hash(token);

  assert.equal(first, service.hash(token));
  assert.notEqual(first, service.hash(`${token}-other`));
  assert.match(
    first,
    new RegExp(`^${refreshTokenHashPrefix}[A-Za-z0-9_-]{43}$`, 'u')
  );
  assert.equal(first.includes(token), false);
  assert.throws(() => service.hash(''), RangeError);
});
