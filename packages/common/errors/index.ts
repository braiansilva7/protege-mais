export interface ApplicationErrorOptions {
  readonly code?: string;
  readonly message?: string;
  readonly messageKey?: string;
  readonly statusCode?: number;
  readonly cause?: unknown;
}

export type SpecializedErrorOptions = Omit<
  ApplicationErrorOptions,
  'statusCode'
>;

export interface ErrorResponse {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
}

const defaultError = {
  code: 'APPLICATION_ERROR',
  message: 'Não foi possível processar a solicitação.',
  messageKey: 'errors.application',
  statusCode: 500,
} as const;

export class ApplicationError extends Error {
  public readonly code: string;
  public readonly messageKey: string | undefined;
  public readonly statusCode: number;

  public constructor(options: ApplicationErrorOptions = {}) {
    const code = options.code ?? defaultError.code;
    const message = options.message ?? defaultError.message;
    const messageKey =
      options.messageKey ??
      (options.message === undefined ? defaultError.messageKey : undefined);
    const statusCode = options.statusCode ?? defaultError.statusCode;

    if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode > 599) {
      throw new RangeError(
        'ApplicationError exige status HTTP entre 400 e 599.'
      );
    }

    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause }
    );

    this.name = new.target.name;
    this.code = code;
    this.messageKey = messageKey;
    this.statusCode = statusCode;
  }
}

export class ValidationError extends ApplicationError {
  public constructor(options: SpecializedErrorOptions = {}) {
    super({
      ...options,
      code: options.code ?? 'VALIDATION_ERROR',
      message: options.message ?? 'Os dados enviados são inválidos.',
      messageKey:
        options.messageKey ??
        (options.message === undefined ? 'errors.validation' : undefined),
      statusCode: 400,
    });
  }
}

export class UnauthorizedError extends ApplicationError {
  public constructor(options: SpecializedErrorOptions = {}) {
    super({
      ...options,
      code: options.code ?? 'UNAUTHORIZED',
      message: options.message ?? 'Autenticação necessária.',
      messageKey:
        options.messageKey ??
        (options.message === undefined ? 'authentication.required' : undefined),
      statusCode: 401,
    });
  }
}

export class ForbiddenError extends ApplicationError {
  public constructor(options: SpecializedErrorOptions = {}) {
    super({
      ...options,
      code: options.code ?? 'FORBIDDEN',
      message: options.message ?? 'Acesso negado.',
      messageKey:
        options.messageKey ??
        (options.message === undefined ? 'errors.forbidden' : undefined),
      statusCode: 403,
    });
  }
}

export class NotFoundError extends ApplicationError {
  public constructor(options: SpecializedErrorOptions = {}) {
    super({
      ...options,
      code: options.code ?? 'NOT_FOUND',
      message: options.message ?? 'Recurso não encontrado.',
      messageKey:
        options.messageKey ??
        (options.message === undefined ? 'errors.notFound' : undefined),
      statusCode: 404,
    });
  }
}

export class ConflictError extends ApplicationError {
  public constructor(options: SpecializedErrorOptions = {}) {
    super({
      ...options,
      code: options.code ?? 'CONFLICT',
      message:
        options.message ?? 'A solicitação está em conflito com o estado atual.',
      messageKey:
        options.messageKey ??
        (options.message === undefined ? 'errors.conflict' : undefined),
      statusCode: 409,
    });
  }
}

export class BusinessRuleError extends ApplicationError {
  public constructor(options: SpecializedErrorOptions = {}) {
    super({
      ...options,
      code: options.code ?? 'BUSINESS_RULE_ERROR',
      message: options.message ?? 'A regra de negócio não foi atendida.',
      messageKey:
        options.messageKey ??
        (options.message === undefined ? 'errors.businessRule' : undefined),
      statusCode: 422,
    });
  }
}

export class InfrastructureError extends ApplicationError {
  public constructor(options: SpecializedErrorOptions = {}) {
    super({
      ...options,
      code: options.code ?? 'INFRASTRUCTURE_ERROR',
      message:
        options.message ?? 'O serviço está temporariamente indisponível.',
      messageKey:
        options.messageKey ??
        (options.message === undefined ? 'errors.infrastructure' : undefined),
      statusCode: 500,
    });
  }
}

export class ServiceUnavailableError extends ApplicationError {
  public constructor(options: SpecializedErrorOptions = {}) {
    super({
      ...options,
      code: options.code ?? 'SERVICE_UNAVAILABLE',
      message:
        options.message ?? 'O serviço está temporariamente indisponível.',
      messageKey:
        options.messageKey ??
        (options.message === undefined
          ? 'errors.serviceUnavailable'
          : undefined),
      statusCode: 503,
    });
  }
}
