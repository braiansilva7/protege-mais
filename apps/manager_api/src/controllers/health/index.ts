import type { FastifyReply, FastifyRequest } from 'fastify';

export class HealthController {
  public health = async (_request: FastifyRequest, _reply: FastifyReply) => ({
    status: 'ok' as const,
  });
}

export const healthController = new HealthController();
