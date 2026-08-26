import {
  createCorrelatedLogger,
  createStructuredLogger,
  createWorkerCorrelationContext,
  type CorrelationMetadata,
} from '@protege-mais/plugins/logging';

export type WorkerLogger = ReturnType<typeof createStructuredLogger>;

export function createWorkerJobLogger(
  logger: WorkerLogger,
  metadata: Partial<CorrelationMetadata> = {}
) {
  const context = createWorkerCorrelationContext(metadata);
  return Object.freeze({
    context,
    logger: createCorrelatedLogger(logger, context),
  });
}
