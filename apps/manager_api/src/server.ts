import {
  ConfigurationError,
  managerApiEnvironment,
} from '@protege-mais/config';
import { buildServer } from './app.js';
import { registerShutdownSignals } from './lifecycle.js';

export { buildServer } from './app.js';

async function start() {
  const configuration = managerApiEnvironment();
  const app = await buildServer(configuration);
  const signals = registerShutdownSignals(app, (error) => {
    app.log.error({ err: error }, 'Falha durante o encerramento da API.');
    process.exitCode = 1;
  });

  try {
    await app.listen({
      port: configuration.port,
      host: configuration.host,
    });
  } catch (error) {
    signals.remove();
    app.log.error(error);

    try {
      await signals.shutdown();
    } catch (shutdownError) {
      app.log.error(
        { err: shutdownError },
        'Falha ao liberar recursos após erro de inicialização.'
      );
    }

    process.exitCode = 1;
  }
}

void start().catch((error: unknown) => {
  if (error instanceof ConfigurationError) {
    process.stderr.write(`${error.message}\n`);
  } else {
    process.stderr.write('Falha inesperada ao iniciar a Manager API.\n');
  }
  process.exitCode = 1;
});
