import type { FastifyInstance } from 'fastify';
import authenticationRoutes from './authentication.route.js';

export const apiV1Prefix = '/api/v1';

export default async function routes(server: FastifyInstance) {
  await server.register(authenticationRoutes);
}
