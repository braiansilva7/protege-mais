import type { FastifyInstance } from 'fastify';
import { healthSchema, readinessSchema } from '@protege-mais/schema';
import { healthController } from '../controllers/health/index.js';

export default function healthRoutes(server: FastifyInstance) {
  server.get('/health', {
    schema: healthSchema,
    handler: healthController.health,
  });

  server.get('/ready', {
    schema: readinessSchema,
    handler: healthController.ready,
  });
}
