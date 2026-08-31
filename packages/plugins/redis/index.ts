import fp from 'fastify-plugin';
import { createClient } from 'redis';
import type { FastifyInstance } from 'fastify';
import type { ReadinessRegistry } from '../readiness/index.js';

export const redisConnectTimeoutMs = 2_000;
export const redisCommandTimeoutMs = 1_000;
export const redisMaximumReconnectDelayMs = 2_000;
export const redisCommandsQueueMaximumLength = 1_000;

type NodeRedisClient = ReturnType<typeof createClient>;

export interface RedisLogger {
  info(context: Readonly<Record<string, unknown>>, message: string): unknown;
  warn(context: Readonly<Record<string, unknown>>, message: string): unknown;
}

export interface RedisCommands {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  setWithExpiration(
    key: string,
    value: string,
    ttlSeconds: number
  ): Promise<void>;
  delete(key: string): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<boolean>;
  incrementWithExpiration(
    key: string,
    ttlSeconds: number
  ): Promise<RedisIncrementWithExpirationResult>;
}

export interface RedisIncrementWithExpirationResult {
  readonly value: number;
  readonly ttlSeconds: number;
}

export interface RedisConnection {
  readonly namespace: string;
  readonly commands: RedisCommands;
  connect(): Promise<void>;
  start(): void;
  isReady(): Promise<boolean>;
  close(): Promise<void>;
}

export interface RedisConnectionOptions {
  readonly redisUrl: string;
  readonly environment: string;
  readonly logger: RedisLogger;
}

export interface RedisPluginOptions {
  readonly redisUrl: string;
  readonly environment: string;
  readonly connection?: RedisConnection;
}

function assertKey(key: string): void {
  if (
    key.length === 0 ||
    key.length > 512 ||
    key !== key.trim() ||
    /[\u0000-\u001f\u007f]/u.test(key)
  ) {
    throw new RangeError('A chave Redis deve ser não vazia e segura.');
  }
}

function assertTtl(ttlSeconds: number): void {
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new RangeError('O TTL Redis deve ser um inteiro positivo.');
  }
}

export function redisKeyNamespace(environment: string): string {
  const normalizedEnvironment = environment.trim().toLowerCase();

  if (!/^(?:local|dev|hmg|prod)$/u.test(normalizedEnvironment)) {
    throw new RangeError('O ambiente do namespace Redis é inválido.');
  }

  return `protege-mais:${normalizedEnvironment}:`;
}

export function redisReconnectDelay(retries: number): number {
  const exponentialDelay = 50 * 2 ** Math.min(retries, 10);
  const jitter = Math.floor(Math.random() * 200);
  return Math.min(exponentialDelay + jitter, redisMaximumReconnectDelayMs);
}

class ManagedRedisConnection implements RedisConnection {
  readonly #client: NodeRedisClient;
  readonly #logger: RedisLogger;
  #connectTask: Promise<void> | undefined;
  #closeTask: Promise<void> | undefined;
  #closing = false;

  public readonly namespace: string;
  public readonly commands: RedisCommands;

  constructor(options: RedisConnectionOptions) {
    this.#logger = options.logger;
    this.namespace = redisKeyNamespace(options.environment);
    this.#client = createClient({
      url: options.redisUrl,
      keyPrefix: this.namespace,
      disableOfflineQueue: true,
      commandsQueueMaxLength: redisCommandsQueueMaximumLength,
      commandOptions: { timeout: redisCommandTimeoutMs },
      socket: {
        connectTimeout: redisConnectTimeoutMs,
        reconnectStrategy: redisReconnectDelay,
      },
    });

    this.commands = Object.freeze({
      get: async (key: string) => {
        assertKey(key);
        return this.#client.get(key);
      },
      set: async (key: string, value: string) => {
        assertKey(key);
        await this.#client.set(key, value);
      },
      setWithExpiration: async (
        key: string,
        value: string,
        ttlSeconds: number
      ) => {
        assertKey(key);
        assertTtl(ttlSeconds);
        await this.#client.setEx(key, ttlSeconds, value);
      },
      delete: async (key: string) => {
        assertKey(key);
        return this.#client.del(key);
      },
      expire: async (key: string, ttlSeconds: number) => {
        assertKey(key);
        assertTtl(ttlSeconds);
        return (await this.#client.expire(key, ttlSeconds)) === 1;
      },
      incrementWithExpiration: async (key: string, ttlSeconds: number) => {
        assertKey(key);
        assertTtl(ttlSeconds);
        const [value, _expirationChanged, remainingTtl] = await this.#client
          .multi()
          .incr(key)
          .expire(key, ttlSeconds, 'NX')
          .ttl(key)
          .exec();

        if (
          typeof value !== 'number' ||
          !Number.isSafeInteger(value) ||
          value < 1 ||
          typeof remainingTtl !== 'number' ||
          !Number.isSafeInteger(remainingTtl) ||
          remainingTtl < 1
        ) {
          throw new Error('O contador Redis retornou estado inválido.');
        }

        return Object.freeze({ value, ttlSeconds: remainingTtl });
      },
    });

    this.#client.on('ready', () => {
      this.#logger.info(
        { event: 'redis.connection.ready' },
        'Conexão Redis pronta.'
      );
    });
    this.#client.on('reconnecting', () => {
      this.#logger.warn(
        { event: 'redis.connection.reconnecting' },
        'Redis indisponível; reconexão agendada.'
      );
    });
    this.#client.on('error', (error: Error) => {
      this.#logger.warn(
        { event: 'redis.connection.error', err: error },
        'Falha segura na conexão Redis.'
      );
    });
    this.#client.on('end', () => {
      this.#logger.info(
        { event: 'redis.connection.closed' },
        'Conexão Redis encerrada.'
      );
    });
  }

  public connect(): Promise<void> {
    if (this.#closing) {
      return Promise.reject(new Error('A conexão Redis está encerrando.'));
    }

    const connectTask =
      this.#connectTask ?? this.#client.connect().then(() => undefined);
    this.#connectTask = connectTask;
    return connectTask;
  }

  public start(): void {
    void this.connect().catch(() => undefined);
  }

  public async isReady(): Promise<boolean> {
    if (!this.#client.isReady || this.#closing) return false;

    try {
      return (await this.#client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  public close(): Promise<void> {
    this.#closeTask ??= this.#close();
    return this.#closeTask;
  }

  async #close(): Promise<void> {
    this.#closing = true;

    if (this.#client.isOpen) {
      await this.#client.close();
    }

    await this.#connectTask?.catch(() => undefined);
  }
}

export function createRedisConnection(
  options: RedisConnectionOptions
): RedisConnection {
  return new ManagedRedisConnection(options);
}

declare module 'fastify' {
  interface FastifyInstance {
    readiness: ReadinessRegistry;
    redis: RedisCommands;
    redisConnection: RedisConnection;
  }
}

function redisPlugin(fastify: FastifyInstance, options: RedisPluginOptions) {
  const connection =
    options.connection ??
    createRedisConnection({
      redisUrl: options.redisUrl,
      environment: options.environment,
      logger: fastify.log,
    });

  fastify.decorate('redis', connection.commands);
  fastify.decorate('redisConnection', connection);
  fastify.readiness.register({
    name: 'redis',
    check: () => connection.isReady(),
  });
  fastify.addHook('onClose', async () => {
    await connection.close();
  });

  connection.start();
}

export const registerRedis = fp<RedisPluginOptions>(redisPlugin, {
  name: 'redis',
  dependencies: ['readiness'],
});

export default registerRedis;
