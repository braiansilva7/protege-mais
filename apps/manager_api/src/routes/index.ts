import type { FastifyInstance } from 'fastify';
import authRoutes from './auth.route.js';
import userRoutes from './user.route.js';
import permissionRoleRoutes from './permission-role.route.js';

export default function routes(server: FastifyInstance) {
  server.register(authRoutes);
  server.register(userRoutes);
  server.register(permissionRoleRoutes);
}
