import type { FastifyInstance } from 'fastify';
import { healthSchema } from '@protege-mais/schema';
import { healthController } from '../controllers/health/index.js';

export default function healthRoutes(server: FastifyInstance) {
  server.get('/health', {
    schema: healthSchema,
    handler: healthController.health,
  });
}
