import type {
  AccessTokenService,
  AuthenticationClock,
  AuthenticationSessionAudit,
  AuthenticationSessionRepository,
  LoginWithEmailAndPasswordResult,
  RefreshAuthenticationSessionInput,
  RefreshAuthenticationSessionUseCase,
  RefreshTokenHashService,
  RefreshTokenService,
} from '@protege-mais/interfaces';
import { InvalidRefreshTokenError } from './errors.js';
import { authenticationTokenIssuedAt } from './time.js';

export class RefreshAuthenticationSession implements RefreshAuthenticationSessionUseCase {
  public constructor(
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly refreshTokenHashes: RefreshTokenHashService,
    private readonly sessions: AuthenticationSessionRepository,
    private readonly audit: AuthenticationSessionAudit,
    private readonly clock: AuthenticationClock
  ) {}

  public async execute(
    input: RefreshAuthenticationSessionInput
  ): Promise<LoginWithEmailAndPasswordResult> {
    const usedAt = authenticationTokenIssuedAt(this.clock.now());
    const verified = await this.refreshTokens.verify(
      input.refreshToken,
      usedAt
    );

    if (verified === null) return this.rejectRefresh();

    const [successor, accessToken] = await Promise.all([
      this.refreshTokens.issue({
        accountId: verified.accountId,
        sessionId: verified.sessionId,
        issuedAt: usedAt,
        expiresAt: verified.expiresAt,
      }),
      this.accessTokens.issue({
        accountId: verified.accountId,
        sessionId: verified.sessionId,
        issuedAt: usedAt,
      }),
    ]);
    const result = await this.sessions.rotate({
      sessionId: verified.sessionId,
      accountId: verified.accountId,
      presentedRefreshTokenHash: this.refreshTokenHashes.hash(
        input.refreshToken
      ),
      successorRefreshTokenHash: this.refreshTokenHashes.hash(successor.token),
      expectedExpiresAt: verified.expiresAt,
      usedAt,
    });

    if (result === 'reused') return this.rejectRefresh(true);
    if (result !== 'rotated') return this.rejectRefresh();

    this.audit.recordRefreshSuccess();
    return Object.freeze({
      accessToken: accessToken.token,
      refreshToken: successor.token,
      tokenType: 'Bearer',
      expiresIn: accessToken.expiresInSeconds,
      refreshExpiresIn: successor.expiresInSeconds,
    });
  }

  private rejectRefresh(reused = false): never {
    if (reused) this.audit.recordRefreshReuse();
    else this.audit.recordRefreshFailure();
    throw new InvalidRefreshTokenError();
  }
}
