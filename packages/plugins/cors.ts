import cors from '@fastify/cors';
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { managerApiEnvironment } from '@protege-mais/config';

async function corsPlugin(server: FastifyInstance) {
  await server.register(cors, {
    origin: managerApiEnvironment().corsOrigin,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });
}

export const registerCors = fp(corsPlugin, { name: 'cors' });
export default registerCors;
