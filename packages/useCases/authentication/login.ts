import type {
  AccessTokenService,
  AuthenticateWithEmailAndPasswordInput,
  AuthenticationClock,
  AuthenticationSessionIdGenerator,
  CredentialAuthenticationUseCase,
  LoginAuthenticationUseCase,
  LoginWithEmailAndPasswordResult,
} from '@protege-mais/interfaces';
import { InvalidCredentialsError } from './errors.js';

export class LoginWithEmailAndPassword implements LoginAuthenticationUseCase {
  public constructor(
    private readonly credentials: CredentialAuthenticationUseCase,
    private readonly accessTokens: AccessTokenService,
    private readonly sessionIds: AuthenticationSessionIdGenerator,
    private readonly clock: AuthenticationClock
  ) {}

  public async execute(
    input: AuthenticateWithEmailAndPasswordInput
  ): Promise<LoginWithEmailAndPasswordResult> {
    const account = await this.credentials.execute(input);

    if (account.mfaEnabled) {
      throw new InvalidCredentialsError();
    }

    const issuedToken = await this.accessTokens.issue({
      accountId: account.accountId,
      sessionId: this.sessionIds.generate(),
      issuedAt: this.clock.now(),
    });

    return Object.freeze({
      accessToken: issuedToken.token,
      tokenType: 'Bearer',
      expiresIn: issuedToken.expiresInSeconds,
    });
  }
}
