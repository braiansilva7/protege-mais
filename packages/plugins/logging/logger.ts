import pino, {
  type DestinationStream,
  type Logger,
  type LoggerOptions,
} from 'pino';
import type { CorrelationContext } from './correlation.js';
import {
  pinoRedactionPaths,
  redactedLogValue,
  safeErrorSerializer,
  sanitizeLogValue,
} from './sanitization.js';

export type LogDestination = DestinationStream;

export interface StructuredLoggerConfiguration {
  readonly service: string;
  readonly environment: string;
  readonly level: string;
  readonly destination?: LogDestination;
}

export function createStructuredLoggerOptions(
  configuration: Omit<StructuredLoggerConfiguration, 'destination'>
): LoggerOptions {
  return {
    base: {
      service: configuration.service,
      environment: configuration.environment,
    },
    level: configuration.level,
    redact: {
      paths: pinoRedactionPaths,
      censor: redactedLogValue,
    },
    serializers: {
      err: safeErrorSerializer,
    },
    hooks: {
      logMethod(args, method) {
        const sanitizedArguments = args.map(sanitizeLogValue) as Parameters<
          typeof method
        >;

        try {
          method.apply(this, sanitizedArguments);
        } catch {
          try {
            method.call(
              this,
              { event: 'logging.serialization.failed' },
              'Registro de log substituído por falha de serialização.'
            );
          } catch {
            // Logging nunca deve interromper o fluxo da aplicação.
          }
        }
      },
    },
  };
}

export function createStructuredLogger(
  configuration: StructuredLoggerConfiguration
) {
  const options = createStructuredLoggerOptions(configuration);
  return configuration.destination === undefined
    ? pino(options)
    : pino(options, configuration.destination);
}

export function createCorrelatedLogger(
  logger: Logger,
  context: CorrelationContext
) {
  return logger.child({ ...context });
}
