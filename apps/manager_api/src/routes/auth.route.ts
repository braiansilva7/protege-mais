import type { FastifyInstance } from 'fastify';
import { container } from 'tsyringe';
import { AuthController } from '@/controllers/auth/index.js';
import { authenticatedPermissions } from '@/permissions/index.js';
import { currentUserSchema } from '@core/schema/auth/me/index.js';
import { loginSchema } from '@core/schema/auth/login/index.js';

export default function authRoutes(server: FastifyInstance) {
  const authController = container.resolve(AuthController);
  server.post('/auth/login', {
    schema: loginSchema,
    handler: authController.login,
  });
  server.get('/auth/me', {
    schema: currentUserSchema,
    handler: authController.currentUser,
    preHandler: [
      (request, reply) =>
        server.authenticateJwt(request, reply, authenticatedPermissions),
    ],
  });
}
