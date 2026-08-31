import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import {
  authSessionRefreshTokenMaximumLength,
  isUuidV7,
} from '@protege-mais/common';
import type {
  IssueRefreshTokenInput,
  IssuedRefreshToken,
  RefreshTokenHashService,
  RefreshTokenService,
  VerifiedRefreshToken,
} from '@protege-mais/interfaces';
import {
  accessTokenIssuer,
  jwtHmacSecretMinimumBytes,
} from './access-token.js';

export const refreshTokenAlgorithm = 'HS256';
export const refreshTokenAudience =
  'urn:protege-mais:manager-api:token-refresh';
export const refreshTokenLifetimeSeconds = 30 * 24 * 60 * 60;
export const refreshTokenMaximumLength = authSessionRefreshTokenMaximumLength;
export const refreshTokenPurpose = 'refresh';
export const refreshTokenTypeHeader = 'rt+jwt';
export const refreshTokenHashPrefix = 'sha256:';

const refreshTokenIdBytes = 32;
const refreshTokenIdPattern = /^[A-Za-z0-9_-]{43}$/u;
const requiredRefreshTokenClaims = [
  'aud',
  'exp',
  'iat',
  'iss',
  'jti',
  'sid',
  'sub',
  'token_use',
] as const;

function validDate(value: Date): boolean {
  return Number.isFinite(value.getTime());
}

function unixTime(value: Date): number {
  return Math.floor(value.getTime() / 1_000);
}

function refreshTokenKey(secret: string): Uint8Array {
  const key = new TextEncoder().encode(secret);

  if (key.byteLength < jwtHmacSecretMinimumBytes) {
    throw new RangeError('O segredo JWT de refresh é insuficiente.');
  }

  return key;
}

export class JoseRefreshTokenService implements RefreshTokenService {
  readonly #key: Uint8Array;

  public constructor(secret: string) {
    this.#key = refreshTokenKey(secret);
  }

  public async issue(
    input: IssueRefreshTokenInput
  ): Promise<IssuedRefreshToken> {
    if (
      !isUuidV7(input.accountId) ||
      !isUuidV7(input.sessionId) ||
      !validDate(input.issuedAt) ||
      (input.expiresAt !== undefined && !validDate(input.expiresAt))
    ) {
      throw new RangeError(
        'Os dados para emissão do refresh token são inválidos.'
      );
    }

    const issuedAt = unixTime(input.issuedAt);
    const expiresAt =
      input.expiresAt === undefined
        ? issuedAt + refreshTokenLifetimeSeconds
        : unixTime(input.expiresAt);
    const expiresInSeconds = expiresAt - issuedAt;

    if (
      expiresInSeconds <= 0 ||
      expiresInSeconds > refreshTokenLifetimeSeconds
    ) {
      throw new RangeError('A validade do refresh token é inválida.');
    }

    const tokenId = randomBytes(refreshTokenIdBytes).toString('base64url');
    const token = await new SignJWT({
      sid: input.sessionId,
      token_use: refreshTokenPurpose,
    })
      .setProtectedHeader({
        alg: refreshTokenAlgorithm,
        typ: refreshTokenTypeHeader,
      })
      .setSubject(input.accountId)
      .setIssuer(accessTokenIssuer)
      .setAudience(refreshTokenAudience)
      .setJti(tokenId)
      .setIssuedAt(issuedAt)
      .setExpirationTime(expiresAt)
      .sign(this.#key);

    return Object.freeze({
      token,
      expiresAt: new Date(expiresAt * 1_000),
      expiresInSeconds,
    });
  }

  public async verify(
    token: string,
    currentDate: Date = new Date()
  ): Promise<VerifiedRefreshToken | null> {
    if (
      token.length === 0 ||
      token.length > refreshTokenMaximumLength ||
      !validDate(currentDate)
    ) {
      return null;
    }

    try {
      const { payload, protectedHeader } = await jwtVerify(token, this.#key, {
        algorithms: [refreshTokenAlgorithm],
        audience: refreshTokenAudience,
        clockTolerance: 0,
        currentDate,
        issuer: accessTokenIssuer,
        requiredClaims: [...requiredRefreshTokenClaims],
        typ: refreshTokenTypeHeader,
      });
      const issuedAt = payload.iat;
      const expiresAt = payload.exp;
      const sessionId = payload.sid;
      const tokenId = payload.jti;
      const now = unixTime(currentDate);

      if (
        protectedHeader.alg !== refreshTokenAlgorithm ||
        protectedHeader.typ !== refreshTokenTypeHeader ||
        payload.aud !== refreshTokenAudience ||
        payload.iss !== accessTokenIssuer ||
        payload.token_use !== refreshTokenPurpose ||
        typeof payload.sub !== 'string' ||
        !isUuidV7(payload.sub) ||
        typeof sessionId !== 'string' ||
        !isUuidV7(sessionId) ||
        typeof tokenId !== 'string' ||
        !refreshTokenIdPattern.test(tokenId) ||
        typeof issuedAt !== 'number' ||
        typeof expiresAt !== 'number' ||
        !Number.isSafeInteger(issuedAt) ||
        !Number.isSafeInteger(expiresAt) ||
        issuedAt > now ||
        expiresAt <= issuedAt ||
        expiresAt - issuedAt > refreshTokenLifetimeSeconds
      ) {
        return null;
      }

      return Object.freeze({
        accountId: payload.sub,
        sessionId,
        tokenId,
        issuedAt: new Date(issuedAt * 1_000),
        expiresAt: new Date(expiresAt * 1_000),
      });
    } catch {
      return null;
    }
  }
}

export class Sha256RefreshTokenHashService implements RefreshTokenHashService {
  public hash(token: string): string {
    if (token.length === 0 || token.length > refreshTokenMaximumLength) {
      throw new RangeError('O refresh token não pode ser convertido em hash.');
    }

    return `${refreshTokenHashPrefix}${createHash('sha256')
      .update(token, 'utf8')
      .digest('base64url')}`;
  }
}
