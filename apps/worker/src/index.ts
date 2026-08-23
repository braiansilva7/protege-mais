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
  process.stdout.write('worker: aguardando configuração de filas\n');
  const signal = await waitForShutdown();
  process.stdout.write(`worker: encerrado por ${signal}\n`);
}

void runWorkerShell();
