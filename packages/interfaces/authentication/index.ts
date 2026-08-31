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
  sessionIdGenerator: 'AuthenticationSessionIdGenerator',
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

export interface LoginWithEmailAndPasswordResult {
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
}

export interface LoginAuthenticationUseCase {
  execute(
    input: AuthenticateWithEmailAndPasswordInput
  ): Promise<LoginWithEmailAndPasswordResult>;
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
