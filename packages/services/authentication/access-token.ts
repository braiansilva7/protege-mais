import { SignJWT, jwtVerify } from 'jose';
import {
  UnauthorizedError,
  createUuidV7,
  isUuidV7,
} from '@protege-mais/common';
import type {
  AccessTokenService,
  AuthenticationSessionIdGenerator,
  IssueAccessTokenInput,
  IssuedAccessToken,
  VerifiedAccessToken,
} from '@protege-mais/interfaces';

export const accessTokenAlgorithm = 'HS256';
export const accessTokenAudience = 'urn:protege-mais:manager-api';
export const accessTokenIssuer = 'urn:protege-mais:authentication';
export const accessTokenLifetimeSeconds = 15 * 60;
export const accessTokenPurpose = 'access';
export const accessTokenTypeHeader = 'at+jwt';
export const jwtHmacSecretMinimumBytes = 32;

const accessTokenMaximumLength = 4_096;
const requiredAccessTokenClaims = [
  'aud',
  'exp',
  'iat',
  'iss',
  'sid',
  'sub',
  'token_use',
] as const;

export class InvalidAccessTokenError extends UnauthorizedError {
  public constructor() {
    super({
      code: 'INVALID_ACCESS_TOKEN',
      message: 'Token de acesso inválido.',
      messageKey: 'authentication.invalidAccessToken',
    });
  }
}

function validDate(value: Date): boolean {
  return Number.isFinite(value.getTime());
}

function unixTime(value: Date): number {
  return Math.floor(value.getTime() / 1_000);
}

function accessTokenKey(secret: string): Uint8Array {
  const key = new TextEncoder().encode(secret);

  if (key.byteLength < jwtHmacSecretMinimumBytes) {
    throw new RangeError('O segredo JWT de acesso é insuficiente.');
  }

  return key;
}

export class JoseAccessTokenService implements AccessTokenService {
  readonly #key: Uint8Array;

  public constructor(secret: string) {
    this.#key = accessTokenKey(secret);
  }

  public async issue(input: IssueAccessTokenInput): Promise<IssuedAccessToken> {
    if (
      !isUuidV7(input.accountId) ||
      !isUuidV7(input.sessionId) ||
      !validDate(input.issuedAt)
    ) {
      throw new RangeError(
        'Os dados para emissão do access token são inválidos.'
      );
    }

    const issuedAt = unixTime(input.issuedAt);
    const expiresAt = issuedAt + accessTokenLifetimeSeconds;
    const token = await new SignJWT({
      sid: input.sessionId,
      token_use: accessTokenPurpose,
    })
      .setProtectedHeader({
        alg: accessTokenAlgorithm,
        typ: accessTokenTypeHeader,
      })
      .setSubject(input.accountId)
      .setIssuer(accessTokenIssuer)
      .setAudience(accessTokenAudience)
      .setIssuedAt(issuedAt)
      .setExpirationTime(expiresAt)
      .sign(this.#key);

    return Object.freeze({
      token,
      expiresInSeconds: accessTokenLifetimeSeconds,
    });
  }

  public async verify(
    token: string,
    currentDate: Date = new Date()
  ): Promise<VerifiedAccessToken> {
    if (
      token.length === 0 ||
      token.length > accessTokenMaximumLength ||
      !validDate(currentDate)
    ) {
      throw new InvalidAccessTokenError();
    }

    try {
      const { payload, protectedHeader } = await jwtVerify(token, this.#key, {
        algorithms: [accessTokenAlgorithm],
        audience: accessTokenAudience,
        clockTolerance: 0,
        currentDate,
        issuer: accessTokenIssuer,
        requiredClaims: [...requiredAccessTokenClaims],
        typ: accessTokenTypeHeader,
      });
      const issuedAt = payload.iat;
      const expiresAt = payload.exp;
      const sessionId = payload.sid;
      const now = unixTime(currentDate);

      if (
        protectedHeader.alg !== accessTokenAlgorithm ||
        protectedHeader.typ !== accessTokenTypeHeader ||
        payload.aud !== accessTokenAudience ||
        payload.iss !== accessTokenIssuer ||
        payload.token_use !== accessTokenPurpose ||
        typeof payload.sub !== 'string' ||
        !isUuidV7(payload.sub) ||
        typeof sessionId !== 'string' ||
        !isUuidV7(sessionId) ||
        typeof issuedAt !== 'number' ||
        typeof expiresAt !== 'number' ||
        !Number.isSafeInteger(issuedAt) ||
        !Number.isSafeInteger(expiresAt) ||
        issuedAt > now ||
        expiresAt - issuedAt !== accessTokenLifetimeSeconds
      ) {
        throw new InvalidAccessTokenError();
      }

      return Object.freeze({
        accountId: payload.sub,
        sessionId,
        issuedAt: new Date(issuedAt * 1_000),
        expiresAt: new Date(expiresAt * 1_000),
      });
    } catch {
      throw new InvalidAccessTokenError();
    }
  }
}

export class UuidV7AuthenticationSessionIdGenerator implements AuthenticationSessionIdGenerator {
  public generate(): string {
    return createUuidV7();
  }
}
