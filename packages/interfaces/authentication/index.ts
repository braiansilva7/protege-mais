import type { AccountStatus } from '@protege-mais/common';

export const authenticationDependencyTokens = Object.freeze({
  accountRepository: 'AccountAuthenticationRepository',
  audit: 'AuthenticationAudit',
  clock: 'AuthenticationClock',
  databaseReadWrite: 'DatabaseRw',
  passwordHashService: 'PasswordHashService',
});

export interface AuthenticateWithEmailAndPasswordInput {
  readonly email: string;
  readonly password: string;
}

export interface AuthenticatedAccount {
  readonly accountId: string;
  readonly mfaEnabled: boolean;
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
