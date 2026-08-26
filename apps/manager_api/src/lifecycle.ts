import type { FastifyInstance } from 'fastify';

export type ShutdownSignal = 'SIGINT' | 'SIGTERM';

export interface ShutdownSignalSource {
  once(signal: ShutdownSignal, listener: () => void): unknown;
  removeListener(signal: ShutdownSignal, listener: () => void): unknown;
}

export interface ShutdownSignalRegistration {
  readonly remove: () => void;
  readonly shutdown: () => Promise<void>;
}

export function createGracefulShutdown(
  app: FastifyInstance
): () => Promise<void> {
  let shutdown: Promise<void> | undefined;

  return () => {
    if (shutdown === undefined) {
      app.readiness.markShuttingDown();
      shutdown = app.close();
    }

    return shutdown;
  };
}

export function registerShutdownSignals(
  app: FastifyInstance,
  onError: (error: unknown) => void,
  signalSource: ShutdownSignalSource = process
): ShutdownSignalRegistration {
  const shutdown = createGracefulShutdown(app);

  const remove = () => {
    signalSource.removeListener('SIGINT', handleSignal);
    signalSource.removeListener('SIGTERM', handleSignal);
  };
  const handleSignal = () => {
    remove();
    void shutdown().catch(onError);
  };

  signalSource.once('SIGINT', handleSignal);
  signalSource.once('SIGTERM', handleSignal);

  return { remove, shutdown };
}
