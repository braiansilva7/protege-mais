import { managerApiEnvironment } from '@protege-mais/config';
import { createStructuredLogger } from '@protege-mais/plugins/logging';
import { buildServer } from './app.js';
import { registerShutdownSignals } from './lifecycle.js';

export { buildServer } from './app.js';

async function start() {
  const configuration = managerApiEnvironment();
  const app = await buildServer(configuration);
  const signals = registerShutdownSignals(app, (error) => {
    app.log.error(
      { event: 'manager-api.shutdown.failed', err: error },
      'Falha durante o encerramento da API.'
    );
    process.exitCode = 1;
  });

  try {
    await app.listen({
      port: configuration.port,
      host: configuration.host,
    });
  } catch (error) {
    signals.remove();
    app.log.error(
      { event: 'manager-api.listen.failed', err: error },
      'Falha ao iniciar o listener da Manager API.'
    );

    try {
      await signals.shutdown();
    } catch (shutdownError) {
      app.log.error(
        { event: 'manager-api.cleanup.failed', err: shutdownError },
        'Falha ao liberar recursos após erro de inicialização.'
      );
    }

    process.exitCode = 1;
  }
}

void start().catch((error: unknown) => {
  const logger = createStructuredLogger({
    service: 'manager-api',
    environment: 'UNKNOWN',
    level: 'error',
  });
  logger.error(
    { event: 'manager-api.bootstrap.failed', err: error },
    'Falha ao iniciar a Manager API.'
  );
  process.exitCode = 1;
});
