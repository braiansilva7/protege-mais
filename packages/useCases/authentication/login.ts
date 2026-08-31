import {
  isValidAuthSessionDeviceIdentifier,
  sanitizeAuthSessionDeviceName,
  sanitizeAuthSessionUserAgent,
  ValidationError,
} from '@protege-mais/common';
import type {
  AccessTokenService,
  AuthenticationClock,
  AuthenticationSessionIdGenerator,
  AuthenticationSessionRepository,
  CredentialAuthenticationUseCase,
  LoginAuthenticationUseCase,
  LoginWithEmailAndPasswordInput,
  LoginWithEmailAndPasswordResult,
  RefreshTokenHashService,
  RefreshTokenService,
} from '@protege-mais/interfaces';
import { InvalidCredentialsError } from './errors.js';
import { authenticationTokenIssuedAt } from './time.js';

export class LoginWithEmailAndPassword implements LoginAuthenticationUseCase {
  public constructor(
    private readonly credentials: CredentialAuthenticationUseCase,
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly refreshTokenHashes: RefreshTokenHashService,
    private readonly sessions: AuthenticationSessionRepository,
    private readonly sessionIds: AuthenticationSessionIdGenerator,
    private readonly clock: AuthenticationClock
  ) {}

  public async execute(
    input: LoginWithEmailAndPasswordInput
  ): Promise<LoginWithEmailAndPasswordResult> {
    if (!isValidAuthSessionDeviceIdentifier(input.deviceIdentifier)) {
      throw new ValidationError();
    }

    const account = await this.credentials.execute(input);

    if (account.mfaEnabled) {
      throw new InvalidCredentialsError();
    }

    const issuedAt = authenticationTokenIssuedAt(this.clock.now());
    const sessionId = this.sessionIds.generate();
    const [issuedAccessToken, issuedRefreshToken] = await Promise.all([
      this.accessTokens.issue({
        accountId: account.accountId,
        sessionId,
        issuedAt,
      }),
      this.refreshTokens.issue({
        accountId: account.accountId,
        sessionId,
        issuedAt,
      }),
    ]);
    const sessionCreated = await this.sessions.create({
      id: sessionId,
      accountId: account.accountId,
      refreshTokenHash: this.refreshTokenHashes.hash(issuedRefreshToken.token),
      deviceIdentifier: input.deviceIdentifier,
      deviceName: sanitizeAuthSessionDeviceName(input.deviceName),
      userAgent: sanitizeAuthSessionUserAgent(input.userAgent),
      expiresAt: issuedRefreshToken.expiresAt,
      createdAt: issuedAt,
    });

    if (!sessionCreated) throw new InvalidCredentialsError();

    return Object.freeze({
      accessToken: issuedAccessToken.token,
      refreshToken: issuedRefreshToken.token,
      tokenType: 'Bearer',
      expiresIn: issuedAccessToken.expiresInSeconds,
      refreshExpiresIn: issuedRefreshToken.expiresInSeconds,
    });
  }
}
