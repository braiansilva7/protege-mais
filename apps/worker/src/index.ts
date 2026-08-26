import { createStructuredLogger } from '@protege-mais/plugins/logging';
import { runWorkerShell } from './app.js';

export { createWorkerJobLogger, runWorkerShell } from './app.js';
export { JobProcessor } from './job-processor.js';
export { waitForShutdown } from './lifecycle.js';

void runWorkerShell().catch((error: unknown) => {
  const logger = createStructuredLogger({
    service: 'worker',
    environment: 'UNKNOWN',
    level: 'error',
  });
  logger.error(
    { event: 'worker.bootstrap.failed', err: error },
    'Falha ao iniciar o Worker.'
  );
  process.exitCode = 1;
});
