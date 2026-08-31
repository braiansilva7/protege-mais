import type { AccountStatus } from '@protege-mais/common';

export const authenticationDependencyTokens = Object.freeze({
  accessTokenService: 'AccessTokenService',
  accountRepository: 'AccountAuthenticationRepository',
  authenticateWithEmailAndPassword: 'AuthenticateWithEmailAndPassword',
  audit: 'AuthenticationAudit',
  clock: 'AuthenticationClock',
  databaseReadWrite: 'DatabaseRw',
  loginRateLimitCounter: 'LoginRateLimitCounter',
  loginRateLimiter: 'LoginRateLimiter',
  loginWithEmailAndPassword: 'LoginWithEmailAndPassword',
  passwordHashService: 'PasswordHashService',
  refreshAuthenticationSession: 'RefreshAuthenticationSession',
  refreshTokenHashService: 'RefreshTokenHashService',
  refreshTokenService: 'RefreshTokenService',
  sessionAudit: 'AuthenticationSessionAudit',
  sessionIdGenerator: 'AuthenticationSessionIdGenerator',
  sessionRepository: 'AuthenticationSessionRepository',
});

export interface AuthenticateWithEmailAndPasswordInput {
  readonly email: string;
  readonly password: string;
}

export interface AuthenticatedAccount {
  readonly accountId: string;
  readonly mfaEnabled: boolean;
}

export interface CredentialAuthenticationUseCase {
  execute(
    input: AuthenticateWithEmailAndPasswordInput
  ): Promise<AuthenticatedAccount>;
}

export interface IssueAccessTokenInput {
  readonly accountId: string;
  readonly sessionId: string;
  readonly issuedAt: Date;
}

export interface IssuedAccessToken {
  readonly token: string;
  readonly expiresInSeconds: number;
}

export interface VerifiedAccessToken {
  readonly accountId: string;
  readonly sessionId: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
}

export interface AccessTokenService {
  issue(input: IssueAccessTokenInput): Promise<IssuedAccessToken>;
  verify(token: string, currentDate?: Date): Promise<VerifiedAccessToken>;
}

export interface AuthenticationSessionIdGenerator {
  generate(): string;
}

export interface LoginWithEmailAndPasswordInput extends AuthenticateWithEmailAndPasswordInput {
  readonly deviceIdentifier: string;
  readonly deviceName?: string;
  readonly userAgent?: string;
}

export interface LoginWithEmailAndPasswordResult {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly refreshExpiresIn: number;
}

export interface LoginAuthenticationUseCase {
  execute(
    input: LoginWithEmailAndPasswordInput
  ): Promise<LoginWithEmailAndPasswordResult>;
}

export interface IssueRefreshTokenInput {
  readonly accountId: string;
  readonly sessionId: string;
  readonly issuedAt: Date;
  readonly expiresAt?: Date;
}

export interface IssuedRefreshToken {
  readonly token: string;
  readonly expiresAt: Date;
  readonly expiresInSeconds: number;
}

export interface VerifiedRefreshToken {
  readonly accountId: string;
  readonly sessionId: string;
  readonly tokenId: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
}

export interface RefreshTokenService {
  issue(input: IssueRefreshTokenInput): Promise<IssuedRefreshToken>;
  verify(
    token: string,
    currentDate?: Date
  ): Promise<VerifiedRefreshToken | null>;
}

export interface RefreshTokenHashService {
  hash(token: string): string;
}

export interface CreateAuthenticationSessionInput {
  readonly id: string;
  readonly accountId: string;
  readonly refreshTokenHash: string;
  readonly deviceIdentifier: string;
  readonly deviceName: string | null;
  readonly userAgent: string | null;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export interface RotateAuthenticationSessionInput {
  readonly sessionId: string;
  readonly accountId: string;
  readonly presentedRefreshTokenHash: string;
  readonly successorRefreshTokenHash: string;
  readonly expectedExpiresAt: Date;
  readonly usedAt: Date;
}

export type RotateAuthenticationSessionResult =
  'invalid' | 'reused' | 'rotated';

export interface AuthenticationSessionRepository {
  create(input: CreateAuthenticationSessionInput): Promise<boolean>;
  rotate(
    input: RotateAuthenticationSessionInput
  ): Promise<RotateAuthenticationSessionResult>;
}

export interface RefreshAuthenticationSessionInput {
  readonly refreshToken: string;
}

export interface RefreshAuthenticationSessionUseCase {
  execute(
    input: RefreshAuthenticationSessionInput
  ): Promise<LoginWithEmailAndPasswordResult>;
}

/** Os métodos não recebem contexto para impedir token e IDs por construção. */
export interface AuthenticationSessionAudit {
  recordRefreshSuccess(): void;
  recordRefreshFailure(): void;
  recordRefreshReuse(): void;
}

export interface LoginRateLimitIncrement {
  readonly value: number;
  readonly ttlSeconds: number;
}

export interface LoginRateLimitCounter {
  incrementWithExpiration(
    key: string,
    ttlSeconds: number
  ): Promise<LoginRateLimitIncrement>;
}

export interface LoginRateLimitConsumption {
  readonly remainingAttempts: number;
  readonly retryAfterSeconds: number;
}

export interface LoginRateLimiter {
  consume(clientAddress: string): Promise<LoginRateLimitConsumption>;
}

export interface AuthenticationAccountRecord {
  readonly id: string;
  readonly passwordHash: string | null;
  readonly status: AccountStatus;
  readonly mfaEnabled: boolean;
}

export interface RecordSuccessfulLoginInput {
  readonly accountId: string;
  readonly expectedPasswordHash: string;
  readonly occurredAt: Date;
}

export interface AccountAuthenticationRepository {
  findByNormalizedEmail(
    emailNormalized: string
  ): Promise<AuthenticationAccountRecord | null>;
  recordSuccessfulLogin(input: RecordSuccessfulLoginInput): Promise<boolean>;
}

export interface PasswordHashService {
  hash(password: string): Promise<string>;
  verify(password: string, encodedHash: string | null): Promise<boolean>;
  needsRehash(encodedHash: string): boolean;
}

/** Os métodos não recebem contexto para impedir PII por construção. */
export interface AuthenticationAudit {
  recordSuccess(): void;
  recordFailure(): void;
}

export interface AuthenticationClock {
  now(): Date;
}

export interface AuthenticationEventLogger {
  info(context: Readonly<Record<string, unknown>>, message: string): unknown;
  warn(context: Readonly<Record<string, unknown>>, message: string): unknown;
}
