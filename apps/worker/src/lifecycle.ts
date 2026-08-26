export const shutdownSignals: readonly NodeJS.Signals[] = Object.freeze([
  'SIGINT',
  'SIGTERM',
]);

export function waitForShutdown(
  abortSignal?: AbortSignal
): Promise<NodeJS.Signals> {
  return new Promise((resolve, reject) => {
    const listeners = new Map<NodeJS.Signals, () => void>();
    const keepAlive = setInterval(() => undefined, 2_147_483_647);
    let settled = false;

    const cleanup = () => {
      clearInterval(keepAlive);
      for (const [registeredSignal, listener] of listeners) {
        process.off(registeredSignal, listener);
      }
      abortSignal?.removeEventListener('abort', cancel);
    };

    const finish = (signal: NodeJS.Signals) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(signal);
    };

    function cancel() {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('A espera pelo sinal de shutdown foi cancelada.'));
    }

    for (const signal of shutdownSignals) {
      const listener = () => finish(signal);
      listeners.set(signal, listener);
      process.once(signal, listener);
    }

    abortSignal?.addEventListener('abort', cancel, { once: true });
    if (abortSignal?.aborted === true) cancel();
  });
}
