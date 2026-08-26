import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

export interface ReadinessProbe {
  readonly name: string;
  readonly check: () => boolean | Promise<boolean>;
}

export class ReadinessRegistry {
  readonly #probes = new Map<string, ReadinessProbe>();
  #acceptingTraffic = true;

  public register(probe: ReadinessProbe): void {
    const name = probe.name.trim();

    if (name.length === 0) {
      throw new RangeError('O probe de readiness deve possuir um nome.');
    }

    if (this.#probes.has(name)) {
      throw new Error(`O probe de readiness "${name}" já foi registrado.`);
    }

    this.#probes.set(name, { ...probe, name });
  }

  public markShuttingDown(): void {
    this.#acceptingTraffic = false;
  }

  public async isReady(): Promise<boolean> {
    if (!this.#acceptingTraffic) return false;

    const results = await Promise.allSettled(
      [...this.#probes.values()].map((probe) =>
        Promise.resolve().then(() => probe.check())
      )
    );

    return (
      this.#acceptingTraffic &&
      results.every(
        (result) => result.status === 'fulfilled' && result.value === true
      )
    );
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    readiness: ReadinessRegistry;
  }
}

function readinessPlugin(fastify: FastifyInstance) {
  const readiness = new ReadinessRegistry();

  fastify.decorate('readiness', readiness);
  fastify.addHook('onClose', () => {
    readiness.markShuttingDown();
  });
}

export const registerReadiness = fp(readinessPlugin, {
  name: 'readiness',
});

export default registerReadiness;
