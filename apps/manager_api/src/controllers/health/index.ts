import type { FastifyReply, FastifyRequest } from 'fastify';
import { ServiceUnavailableError } from '@protege-mais/common';

export class HealthController {
  public health = async (_request: FastifyRequest, _reply: FastifyReply) => ({
    status: 'ok' as const,
  });

  public ready = async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!(await request.server.readiness.isReady())) {
      throw new ServiceUnavailableError({
        code: 'SERVICE_NOT_READY',
        messageKey: 'health.notReady',
      });
    }

    return { status: 'ok' as const };
  };
}

export const healthController = new HealthController();
