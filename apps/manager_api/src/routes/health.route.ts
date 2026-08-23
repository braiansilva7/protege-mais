import type { FastifyInstance } from 'fastify';
import { healthController } from '@/controllers/health/index.js';
import { healthSchema } from '@core/schema/health/health/index.js';

export default function healthRoutes(server: FastifyInstance) {
  server.get('/health', {
    schema: healthSchema,
    handler: healthController.health,
  });
}
