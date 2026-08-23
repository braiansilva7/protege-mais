import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { container } from 'tsyringe';
import type { PermissionAction } from '@core/common/types/permission.js';
import { UserRepository } from '@core/repositories/user/user.repository.js';

export function registerAuthenticateJwt(server: FastifyInstance) {
  server.decorate(
    'authenticateJwt',
    async (
      request: FastifyRequest,
      reply: FastifyReply,
      allowedPermissions: PermissionAction[]
    ) => {
      try {
        await request.jwtVerify();
      } catch {
        reply
          .code(401)
          .send({ message: request.t('auth_invalid_or_expired_token') });
        return;
      }

      const userRepository = container.resolve(UserRepository);
      const user = await userRepository.findById(request.user.user_id);
      if (!user || !user.active) {
        reply.code(401).send({ message: request.t('auth_unauthorized_user') });
        return;
      }
      if (
        allowedPermissions.length &&
        !allowedPermissions.some((permission) =>
          user.permissions.includes(permission)
        )
      ) {
        reply.code(403).send({ message: request.t('auth_permission_denied') });
        return;
      }
      request.authenticatedUser = user;
    }
  );
}
