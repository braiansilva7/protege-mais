import { UnauthorizedError } from '@protege-mais/common';

export class InvalidCredentialsError extends UnauthorizedError {
  public constructor() {
    super({
      code: 'INVALID_CREDENTIALS',
      message: 'E-mail ou senha inválidos.',
      messageKey: 'authentication.invalidCredentials',
    });
  }
}

export class InvalidRefreshTokenError extends UnauthorizedError {
  public constructor() {
    super({
      code: 'INVALID_REFRESH_TOKEN',
      message: 'Refresh token inválido.',
      messageKey: 'authentication.invalidRefreshToken',
    });
  }
}
