import type { FastifyInstance } from 'fastify';
import { container } from 'tsyringe';
import { RoleController } from '@/controllers/role/index.js';
import {
  roleCreatePermissions,
  roleDeletePermissions,
  roleEditPermissions,
  rolePermissionsUpdatePermissions,
  roleViewPermissions,
} from '@/permissions/index.js';
export default function permissionRoleRoutes(server: FastifyInstance) {
  const controller = container.resolve(RoleController);
  server.get('/permission-roles', {
    handler: controller.list,
    preHandler: [(q, r) => server.authenticateJwt(q, r, roleViewPermissions)],
  });
  server.get('/permission-roles/:id', {
    handler: controller.view,
    preHandler: [(q, r) => server.authenticateJwt(q, r, roleViewPermissions)],
  });
  server.post('/permission-roles', {
    handler: controller.create,
    preHandler: [(q, r) => server.authenticateJwt(q, r, roleCreatePermissions)],
  });
  server.patch('/permission-roles/:id', {
    handler: controller.update,
    preHandler: [(q, r) => server.authenticateJwt(q, r, roleEditPermissions)],
  });
  server.put('/permission-roles/:id/permissions', {
    handler: controller.setPermissions,
    preHandler: [
      (q, r) => server.authenticateJwt(q, r, rolePermissionsUpdatePermissions),
    ],
  });
  server.delete('/permission-roles/:id', {
    handler: controller.remove,
    preHandler: [(q, r) => server.authenticateJwt(q, r, roleDeletePermissions)],
  });
}
