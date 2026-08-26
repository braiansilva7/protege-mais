import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  ApplicationError,
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@protege-mais/common';
import type { ErrorResponse } from '@protege-mais/schema';

const internalServerError = {
  code: 'INTERNAL_SERVER_ERROR',
  message: 'Ocorreu um erro interno no servidor.',
  messageKey: 'errors.internalServer',
  statusCode: 500,
} as const;

function hasValidationDetails(error: unknown) {
  return (
    error instanceof Error &&
    'validation' in error &&
    error.validation !== undefined
  );
}

function readClientStatusCode(error: unknown) {
  if (!(error instanceof Error) || !('statusCode' in error)) {
    return undefined;
  }

  const { statusCode } = error;
  return typeof statusCode === 'number' &&
    Number.isInteger(statusCode) &&
    statusCode >= 400 &&
    statusCode < 500
    ? statusCode
    : undefined;
}

function mapClientError(error: unknown): ApplicationError | undefined {
  if (error instanceof ApplicationError) {
    return error;
  }

  if (hasValidationDetails(error)) {
    return new ValidationError({ cause: error });
  }

  const statusCode = readClientStatusCode(error);

  switch (statusCode) {
    case 400:
      return new ValidationError({ cause: error });
    case 401:
      return new UnauthorizedError({ cause: error });
    case 403:
      return new ForbiddenError({ cause: error });
    case 404:
      return new NotFoundError({ cause: error });
    case 409:
      return new ConflictError({ cause: error });
    case 422:
      return new BusinessRuleError({ cause: error });
    default:
      return statusCode === undefined
        ? undefined
        : new ApplicationError({
            cause: error,
            code: 'REQUEST_ERROR',
            message: 'Não foi possível processar a solicitação.',
            messageKey: 'errors.request',
            statusCode,
          });
  }
}

function errorForLog(error: unknown) {
  if (error instanceof ApplicationError && error.cause instanceof Error) {
    return error.cause;
  }

  return error instanceof Error
    ? error
    : new Error('Valor não-Error lançado durante a requisição.', {
        cause: error,
      });
}

function logApplicationError(
  request: FastifyRequest,
  error: ApplicationError,
  originalError: unknown
) {
  const context = {
    errorCode: error.code,
    requestId: request.id,
    statusCode: error.statusCode,
  };

  if (error.statusCode >= 500) {
    request.log.error(
      { ...context, err: errorForLog(originalError) },
      'Falha interna durante a requisição.'
    );
    return;
  }

  request.log.info(context, 'Requisição rejeitada.');
}

function sendErrorResponse(
  request: FastifyRequest,
  reply: FastifyReply,
  error: Pick<
    ApplicationError,
    'code' | 'message' | 'messageKey' | 'statusCode'
  >
) {
  const translatedMessage =
    error.messageKey === undefined || typeof request.t !== 'function'
      ? error.message
      : request.t(error.messageKey, { defaultValue: error.message });
  const response: ErrorResponse = {
    code: error.code,
    message:
      typeof translatedMessage === 'string' ? translatedMessage : error.message,
    requestId: request.id,
  };

  return reply.status(error.statusCode).type('application/json').send(response);
}

function errorHandlerPlugin(fastify: FastifyInstance) {
  fastify.setErrorHandler<unknown>((error, request, reply) => {
    const applicationError = mapClientError(error);

    if (applicationError) {
      logApplicationError(request, applicationError, error);
      return sendErrorResponse(request, reply, applicationError);
    }

    request.log.error(
      {
        err: errorForLog(error),
        errorCode: internalServerError.code,
        requestId: request.id,
        statusCode: internalServerError.statusCode,
      },
      'Falha interna durante a requisição.'
    );

    return sendErrorResponse(request, reply, internalServerError);
  });

  fastify.setNotFoundHandler((request, reply) => {
    const error = new NotFoundError();
    logApplicationError(request, error, error);
    return sendErrorResponse(request, reply, error);
  });
}

export const registerErrorHandler = fp(errorHandlerPlugin, {
  name: 'error-handler',
});

export default registerErrorHandler;
