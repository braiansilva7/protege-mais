import type { FastifyInstance } from 'fastify';
import { container } from 'tsyringe';
import { UserController } from '@/controllers/user/index.js';
import {
  userCreatePermissions,
  userDeletePermissions,
  userUpdatePermissions,
  userViewPermissions,
} from '@/permissions/index.js';
import { createUserSchema } from '@core/schema/user/createUser/index.js';
import { deleteUserSchema } from '@core/schema/user/deleteUser/index.js';
import { listUsersSchema } from '@core/schema/user/listUsers/index.js';
import { updateUserSchema } from '@core/schema/user/updateUser/index.js';

export default function userRoutes(server: FastifyInstance) {
  const userController = container.resolve(UserController);
  server.get('/users', {
    schema: listUsersSchema,
    handler: userController.listUsers,
    preHandler: [
      (request, reply) =>
        server.authenticateJwt(request, reply, userViewPermissions),
    ],
  });
  server.post('/users', {
    schema: createUserSchema,
    handler: userController.createUser,
    preHandler: [
      (request, reply) =>
        server.authenticateJwt(request, reply, userCreatePermissions),
    ],
  });
  server.patch('/users/:id', {
    schema: updateUserSchema,
    handler: userController.updateUser,
    preHandler: [
      (request, reply) =>
        server.authenticateJwt(request, reply, userUpdatePermissions),
    ],
  });
  server.delete('/users/:id', {
    schema: deleteUserSchema,
    handler: userController.deleteUser,
    preHandler: [
      (request, reply) =>
        server.authenticateJwt(request, reply, userDeletePermissions),
    ],
  });
}
