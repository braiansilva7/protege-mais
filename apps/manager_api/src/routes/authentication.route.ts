import type { FastifyInstance } from 'fastify';
import { LoginRateLimitExceededError } from '@protege-mais/middlewares';
import { loginSchema } from '@protege-mais/schema';
import { authenticationController } from '../controllers/authentication/index.js';

export default function authenticationRoutes(server: FastifyInstance) {
  server.post('/auth/login', {
    schema: loginSchema,
    preHandler: async (request, reply) => {
      try {
        await request.server.loginRateLimiter.consume(request.ip);
      } catch (error) {
        if (error instanceof LoginRateLimitExceededError) {
          void reply.header('Retry-After', String(error.retryAfterSeconds));
        }
        throw error;
      }
    },
    handler: authenticationController.login,
  });
}
