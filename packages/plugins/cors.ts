import cors from '@fastify/cors';
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

export interface CorsPluginOptions {
  readonly origins: readonly string[];
}

async function corsPlugin(server: FastifyInstance, options: CorsPluginOptions) {
  await server.register(cors, {
    origin: [...options.origins],
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });
}

export const registerCors = fp<CorsPluginOptions>(corsPlugin, { name: 'cors' });
export default registerCors;
