import type { IncomingMessage } from 'node:http';
import type {
  FastifyInstance,
  FastifyRequest,
  FastifyServerOptions,
} from 'fastify';
import fp from 'fastify-plugin';
import {
  correlationIdHeader,
  createCorrelationContext,
  requestIdHeader,
  validCorrelationIdentifier,
} from './correlation.js';

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
  }
}

function requestHeader(request: IncomingMessage, name: string) {
  return request.headers[name];
}

export function requestIdFromRequest(request: IncomingMessage) {
  return createCorrelationContext({
    requestId: requestHeader(request, requestIdHeader),
  }).requestId;
}

export const createRequestLogger: NonNullable<
  FastifyServerOptions['childLoggerFactory']
> = (logger, bindings, childLoggerOptions, request) => {
  const requestId = validCorrelationIdentifier(bindings.requestId);
  const context = createCorrelationContext({
    requestId: requestId ?? requestHeader(request, requestIdHeader),
    correlationId: requestHeader(request, correlationIdHeader),
  });

  return logger.child(
    { ...bindings, correlationId: context.correlationId },
    childLoggerOptions
  );
};

export function normalizedRequestRoute(request: FastifyRequest) {
  if (request.is404) return 'unmatched';

  const route = request.routeOptions.url;
  return typeof route === 'string' && route.startsWith('/')
    ? route
    : 'unmatched';
}

function logCompletedRequest(
  request: FastifyRequest,
  statusCode: number,
  elapsedTime: number
) {
  const context = {
    event: 'http.request.completed',
    requestId: request.id,
    correlationId: request.correlationId,
    method: request.method,
    route: normalizedRequestRoute(request),
    statusCode,
    durationMs: Number.isFinite(elapsedTime)
      ? Math.round(elapsedTime * 1000) / 1000
      : 0,
  };

  try {
    if (statusCode >= 500) {
      request.log.error(context, 'Requisição concluída com falha interna.');
    } else if (statusCode >= 400) {
      request.log.warn(context, 'Requisição rejeitada.');
    } else {
      request.log.info(context, 'Requisição concluída.');
    }
  } catch {
    // Falha no destino ou serializador do log não altera a resposta HTTP.
  }
}

function loggingPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest('correlationId', '');

  fastify.addHook('onRequest', (request, reply, done) => {
    const context = createCorrelationContext({
      requestId: request.id,
      correlationId: request.headers[correlationIdHeader],
    });

    request.correlationId = context.correlationId;
    void reply.header(requestIdHeader, context.requestId);
    void reply.header(correlationIdHeader, context.correlationId);
    done();
  });

  fastify.addHook('onResponse', (request, reply, done) => {
    logCompletedRequest(request, reply.statusCode, reply.elapsedTime);
    done();
  });
}

export const registerLogging = fp(loggingPlugin, { name: 'logging' });
