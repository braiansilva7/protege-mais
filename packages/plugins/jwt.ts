import jwt from '@fastify/jwt';
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { managerApiEnvironment } from '@core/config/environments.js';

async function jwtPlugin(server: FastifyInstance) {
  const config = managerApiEnvironment();
  await server.register(jwt, {
    secret: config.jwtSecret,
    sign: { expiresIn: config.jwtSecretExpiresIn },
  });
}

export const registerJwt = fp(jwtPlugin, { name: 'jwt' });
export default registerJwt;
