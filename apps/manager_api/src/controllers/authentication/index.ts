import type { FastifyReply, FastifyRequest } from 'fastify';
import type {
  LoginRequest,
  RefreshAuthenticationRequest,
} from '@protege-mais/schema';

export class AuthenticationController {
  public login = async (
    request: FastifyRequest<{ Body: LoginRequest }>,
    reply: FastifyReply
  ) => {
    const result = await request.server.loginWithEmailAndPassword.execute({
      ...request.body,
      userAgent: request.headers['user-agent'],
    });

    return reply
      .header('cache-control', 'no-store')
      .header('pragma', 'no-cache')
      .status(200)
      .send(result);
  };

  public refresh = async (
    request: FastifyRequest<{ Body: RefreshAuthenticationRequest }>,
    reply: FastifyReply
  ) => {
    const result = await request.server.refreshAuthenticationSession.execute(
      request.body
    );

    return reply
      .header('cache-control', 'no-store')
      .header('pragma', 'no-cache')
      .status(200)
      .send(result);
  };
}

export const authenticationController = new AuthenticationController();
