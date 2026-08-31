import {
  isAuthenticationEmailLookupCandidate,
  normalizeAccountEmail,
} from '@protege-mais/common';
import {
  type AccountAuthenticationRepository,
  type AuthenticateWithEmailAndPasswordInput,
  type AuthenticatedAccount,
  type AuthenticationAudit,
  type AuthenticationClock,
  type PasswordHashService,
} from '@protege-mais/interfaces';
import { InvalidCredentialsError } from './errors.js';

export { InvalidCredentialsError } from './errors.js';
export { LoginWithEmailAndPassword } from './login.js';

export const invalidAuthenticationEmailLookupKey =
  'invalid-authentication-email';

export class AuthenticateWithEmailAndPassword {
  public constructor(
    private readonly accounts: AccountAuthenticationRepository,
    private readonly passwordHashes: PasswordHashService,
    private readonly audit: AuthenticationAudit,
    private readonly clock: AuthenticationClock
  ) {}

  public async execute(
    input: AuthenticateWithEmailAndPasswordInput
  ): Promise<AuthenticatedAccount> {
    const emailNormalized = normalizeAccountEmail(input.email);
    const emailLookupKey = isAuthenticationEmailLookupCandidate(emailNormalized)
      ? emailNormalized
      : invalidAuthenticationEmailLookupKey;
    const account = await this.accounts.findByNormalizedEmail(emailLookupKey);
    const passwordMatches = await this.passwordHashes.verify(
      input.password,
      account?.passwordHash ?? null
    );

    if (
      !passwordMatches ||
      account?.status !== 'active' ||
      account.passwordHash === null
    ) {
      return this.rejectCredentials();
    }

    const loginRecorded = await this.accounts.recordSuccessfulLogin({
      accountId: account.id,
      expectedPasswordHash: account.passwordHash,
      occurredAt: this.clock.now(),
    });

    if (!loginRecorded) return this.rejectCredentials();

    this.audit.recordSuccess();
    return Object.freeze({
      accountId: account.id,
      mfaEnabled: account.mfaEnabled,
    });
  }

  private rejectCredentials(): never {
    this.audit.recordFailure();
    throw new InvalidCredentialsError();
  }
}
