import type { FastifyReply, FastifyRequest } from 'fastify';
import type { LoginRequest } from '@protege-mais/schema';

export class AuthenticationController {
  public login = async (
    request: FastifyRequest<{ Body: LoginRequest }>,
    reply: FastifyReply
  ) => {
    const result = await request.server.loginWithEmailAndPassword.execute(
      request.body
    );

    return reply.status(200).send(result);
  };
}

export const authenticationController = new AuthenticationController();
