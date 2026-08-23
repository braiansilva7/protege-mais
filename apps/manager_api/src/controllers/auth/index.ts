import type { FastifyReply, FastifyRequest } from 'fastify';
import { injectable, inject } from 'tsyringe';
import { managerApiEnvironment } from '@core/config/environments.js';
import { toPublicUser } from '@core/common/functions/to-public-user.js';
import { LoginUseCase } from '@core/useCases/auth/Login.usecase.js';
import type { LoginRequest } from '@core/schema/auth/login/request.schema.js';

@injectable()
export class AuthController {
  constructor(
    @inject(LoginUseCase) private readonly loginUseCase: LoginUseCase
  ) {}

  public login = async (
    request: FastifyRequest<{ Body: LoginRequest }>,
    reply: FastifyReply
  ) => {
    const { email, password } = request.body;
    if (!email || !password) {
      return reply
        .code(400)
        .send({ message: request.t('auth_credentials_required') });
    }

    const user = await this.loginUseCase.execute(email, password);
    if (!user)
      return reply
        .code(401)
        .send({ message: request.t('auth_invalid_credentials') });

    const config = managerApiEnvironment();
    const accessToken = await reply.jwtSign({
      user_id: user.id,
      module: 'manager',
    });
    return {
      access_token: accessToken,
      token_type: 'Bearer' as const,
      expires_in: config.jwtSecretExpiresIn,
      user: toPublicUser(user),
    };
  };

  public currentUser = async (request: FastifyRequest) => ({
    user: toPublicUser(request.authenticatedUser!),
  });
}
