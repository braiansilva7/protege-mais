import { ConfigurationError, workerEnvironment } from '@protege-mais/config';

const shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

export function waitForShutdown(): Promise<NodeJS.Signals> {
  return new Promise((resolve) => {
    const listeners = new Map<NodeJS.Signals, () => void>();
    const keepAlive = setInterval(() => undefined, 2_147_483_647);

    const finish = (signal: NodeJS.Signals) => {
      clearInterval(keepAlive);

      for (const [registeredSignal, listener] of listeners) {
        process.off(registeredSignal, listener);
      }

      resolve(signal);
    };

    for (const signal of shutdownSignals) {
      const listener = () => finish(signal);
      listeners.set(signal, listener);
      process.once(signal, listener);
    }
  });
}

export async function runWorkerShell(): Promise<void> {
  workerEnvironment();
  process.stdout.write('worker: aguardando configuração de filas\n');
  const signal = await waitForShutdown();
  process.stdout.write(`worker: encerrado por ${signal}\n`);
}

void runWorkerShell().catch((error: unknown) => {
  if (error instanceof ConfigurationError) {
    process.stderr.write(`${error.message}\n`);
  } else {
    process.stderr.write('Falha inesperada ao iniciar o Worker.\n');
  }
  process.exitCode = 1;
});
