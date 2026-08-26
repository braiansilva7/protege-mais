import { createHash } from 'node:crypto';
import {
  Queue,
  UnrecoverableError,
  Worker,
  createNodeRedisClient,
  type Job,
} from 'bullmq';
import { createClient } from 'redis';
import { validCorrelationIdentifier } from '../logging/correlation.js';
import {
  redisCommandsQueueMaximumLength,
  redisConnectTimeoutMs,
  redisKeyNamespace,
  redisReconnectDelay,
} from '../redis/index.js';

export const queueNames = Object.freeze([
  'emergency',
  'notifications',
  'integrations',
  'evidences',
  'risk',
] as const);

export type QueueName = (typeof queueNames)[number];
export type JobPayload = Readonly<Record<string, unknown>>;

export const jobContractVersion = 1 as const;
export const queueJobDataMaximumBytes = 16 * 1_024;
export const queueDefaultRetryPolicy = Object.freeze({
  attempts: 3,
  backoffDelayMs: 1_000,
});

const jobNamePattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const generatedJobIdPattern = /^job-[a-f0-9]{64}$/;
const forbiddenPayloadKeys = new Set([
  'accesstoken',
  'address',
  'authorization',
  'buffer',
  'content',
  'coordinates',
  'cpf',
  'email',
  'evidencecontent',
  'file',
  'idempotencykey',
  'latitude',
  'longitude',
  'narrative',
  'password',
  'phone',
  'refreshtoken',
  'report',
  'secret',
  'token',
]);

export interface BaseJobEnvelope {
  readonly version: typeof jobContractVersion;
  readonly correlationId: string;
  readonly payload: JobPayload;
}

export interface QueueRetryPolicy {
  readonly attempts: number;
  readonly backoffDelayMs: number;
}

export interface QueueLogger {
  info(context: Readonly<Record<string, unknown>>, message: string): unknown;
  warn(context: Readonly<Record<string, unknown>>, message: string): unknown;
}

export interface QueueInfrastructureOptions {
  readonly redisUrl: string;
  readonly environment: string;
  readonly logger: QueueLogger;
  readonly retryPolicy?: QueueRetryPolicy;
}

export interface PublishJobInput {
  readonly envelope: BaseJobEnvelope;
  readonly idempotencyKey: string;
  readonly jobName: string;
  readonly queueName: QueueName;
}

export interface QueueJobIdentity {
  readonly queueName: QueueName;
  readonly jobName: string;
  readonly idempotencyKey: string;
}

export interface PublishedJob {
  readonly queueName: QueueName;
  readonly jobName: string;
  readonly jobId: string;
}

export interface QueueJobSnapshot {
  readonly queueName: QueueName;
  readonly jobName: string;
  readonly jobId: string;
  readonly state: string;
  readonly attemptsMade: number;
}

export interface QueueJob {
  readonly queueName: QueueName;
  readonly jobName: string;
  readonly jobId: string;
  readonly envelope: BaseJobEnvelope;
  readonly attempt: number;
  readonly maxAttempts: number;
}

export type QueueJobHandler = (job: QueueJob) => Promise<void>;

export interface QueueProducerContract {
  publish(input: PublishJobInput): Promise<PublishedJob>;
  inspect(input: QueueJobIdentity): Promise<QueueJobSnapshot | undefined>;
  removeSettled(input: QueueJobIdentity): Promise<boolean>;
  close(): Promise<void>;
}

export interface QueueWorkerPoolContract {
  start(): Promise<void>;
  close(): Promise<void>;
}

interface ManagedQueueConnection {
  readonly connection: ReturnType<typeof createNodeRedisClient>;
  close(): Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  try {
    const prototype = Object.getPrototypeOf(value) as unknown;
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function normalizedPayloadKey(key: string): string {
  return key.replaceAll(/[^a-z0-9]/giu, '').toLowerCase();
}

function assertPayloadValue(
  value: unknown,
  ancestors: Set<object>,
  depth: number
): void {
  if (depth > 12) {
    throw new RangeError('O payload do job excede a profundidade permitida.');
  }
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('O payload do job deve conter números finitos.');
    }
    return;
  }
  if (typeof value !== 'object') {
    throw new TypeError('O payload do job deve ser serializável em JSON.');
  }
  if (ancestors.has(value)) {
    throw new TypeError('O payload do job não pode conter ciclos.');
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      for (const item of value) {
        assertPayloadValue(item, ancestors, depth + 1);
      }
      return;
    }
    if (!isRecord(value)) {
      throw new TypeError('O payload do job deve usar objetos JSON simples.');
    }

    for (const [key, item] of Object.entries(value)) {
      if (forbiddenPayloadKeys.has(normalizedPayloadKey(key))) {
        throw new TypeError('O payload do job contém um campo proibido.');
      }
      assertPayloadValue(item, ancestors, depth + 1);
    }
  } finally {
    ancestors.delete(value);
  }
}

function assertJobName(jobName: string): void {
  if (jobName.length > 128 || !jobNamePattern.test(jobName)) {
    throw new RangeError('O nome do job é inválido.');
  }
}

function assertIdempotencyKey(idempotencyKey: string): void {
  if (
    idempotencyKey.length === 0 ||
    idempotencyKey.length > 512 ||
    idempotencyKey !== idempotencyKey.trim() ||
    /[\u0000-\u001f\u007f]/u.test(idempotencyKey)
  ) {
    throw new RangeError('A chave de idempotência do job é inválida.');
  }
}

function assertEnvelopeSize(envelope: BaseJobEnvelope): void {
  let serialized: string;
  try {
    serialized = JSON.stringify(envelope);
  } catch {
    throw new TypeError('O envelope do job deve ser serializável em JSON.');
  }
  if (Buffer.byteLength(serialized, 'utf8') > queueJobDataMaximumBytes) {
    throw new RangeError('O envelope do job excede o tamanho permitido.');
  }
}

function parseJobEnvelope(value: unknown): BaseJobEnvelope {
  const correlationId = isRecord(value)
    ? validCorrelationIdentifier(value.correlationId)
    : undefined;
  if (
    !isRecord(value) ||
    value.version !== jobContractVersion ||
    correlationId === undefined ||
    !isRecord(value.payload)
  ) {
    throw new TypeError('O envelope do job é inválido.');
  }

  assertPayloadValue(value.payload, new Set(), 0);
  const envelope = Object.freeze({
    version: jobContractVersion,
    correlationId,
    payload: value.payload,
  });
  assertEnvelopeSize(envelope);
  return envelope;
}

function normalizeRetryPolicy(
  policy: QueueRetryPolicy | undefined
): QueueRetryPolicy {
  const normalized = policy ?? queueDefaultRetryPolicy;
  if (
    !Number.isSafeInteger(normalized.attempts) ||
    normalized.attempts < 1 ||
    normalized.attempts > 10 ||
    !Number.isSafeInteger(normalized.backoffDelayMs) ||
    normalized.backoffDelayMs < 1 ||
    normalized.backoffDelayMs > 60_000
  ) {
    throw new RangeError('A política de retry da fila é inválida.');
  }

  return Object.freeze({ ...normalized });
}

export function createJobEnvelope(
  correlationId: string,
  payload: JobPayload
): BaseJobEnvelope {
  return parseJobEnvelope({
    version: jobContractVersion,
    correlationId,
    payload,
  });
}

export function queueJobId(jobName: string, idempotencyKey: string): string {
  assertJobName(jobName);
  assertIdempotencyKey(idempotencyKey);
  const digest = createHash('sha256')
    .update(jobName)
    .update('\u0000')
    .update(idempotencyKey)
    .digest('hex');
  return `job-${digest}`;
}

export function queueKeyPrefix(environment: string): string {
  return `${redisKeyNamespace(environment)}queues`;
}

function queueByName<T>(queues: ReadonlyMap<QueueName, T>, name: QueueName): T {
  const queue = queues.get(name);
  if (queue === undefined) {
    throw new RangeError('A fila informada não pertence ao catálogo.');
  }
  return queue;
}

function createQueueConnection(
  options: QueueInfrastructureOptions,
  queueName: QueueName,
  connectionRole: 'producer' | 'consumer'
): ManagedQueueConnection {
  const rawClient = createClient({
    url: options.redisUrl,
    disableOfflineQueue: connectionRole === 'producer',
    commandsQueueMaxLength: redisCommandsQueueMaximumLength,
    socket: {
      connectTimeout: redisConnectTimeoutMs,
      reconnectStrategy: redisReconnectDelay,
    },
  });
  rawClient.on('error', () => {
    options.logger.warn(
      {
        event: 'queue.connection.error',
        queue: queueName,
        connectionRole,
      },
      'Falha segura na conexão da fila.'
    );
  });
  return Object.freeze({
    connection: createNodeRedisClient(rawClient),
    close: async () => {
      if (rawClient.isOpen) {
        await rawClient.close();
      }
    },
  });
}

export class QueueRetryableError extends Error {
  public constructor() {
    super('RETRYABLE_JOB_FAILURE');
    this.name = 'QueueRetryableError';
  }
}

export class QueueTerminalError extends Error {
  public constructor() {
    super('TERMINAL_JOB_FAILURE');
    this.name = 'QueueTerminalError';
  }
}

export class QueueProducer implements QueueProducerContract {
  readonly #queues: ReadonlyMap<
    QueueName,
    Queue<BaseJobEnvelope, void, string>
  >;
  readonly #connections: readonly ManagedQueueConnection[];
  #closeTask: Promise<void> | undefined;

  public constructor(options: QueueInfrastructureOptions) {
    const retryPolicy = normalizeRetryPolicy(options.retryPolicy);
    const prefix = queueKeyPrefix(options.environment);
    const connections: ManagedQueueConnection[] = [];
    this.#queues = new Map(
      queueNames.map((queueName) => {
        const managedConnection = createQueueConnection(
          options,
          queueName,
          'producer'
        );
        connections.push(managedConnection);
        const queue = new Queue<BaseJobEnvelope, void, string>(queueName, {
          connection: managedConnection.connection,
          prefix,
          defaultJobOptions: {
            attempts: retryPolicy.attempts,
            backoff: {
              type: 'exponential',
              delay: retryPolicy.backoffDelayMs,
            },
            removeOnComplete: false,
            removeOnFail: false,
            stackTraceLimit: 0,
            sizeLimit: queueJobDataMaximumBytes,
          },
        });
        queue.on('error', () => {
          options.logger.warn(
            { event: 'queue.producer.error', queue: queueName },
            'Falha segura no produtor da fila.'
          );
        });
        return [queueName, queue] as const;
      })
    );
    this.#connections = connections;
  }

  public async publish(input: PublishJobInput): Promise<PublishedJob> {
    assertJobName(input.jobName);
    const envelope = parseJobEnvelope(input.envelope);
    const jobId = queueJobId(input.jobName, input.idempotencyKey);
    await queueByName(this.#queues, input.queueName).add(
      input.jobName,
      envelope,
      { jobId }
    );

    return Object.freeze({
      queueName: input.queueName,
      jobName: input.jobName,
      jobId,
    });
  }

  public async inspect(
    input: QueueJobIdentity
  ): Promise<QueueJobSnapshot | undefined> {
    const jobId = queueJobId(input.jobName, input.idempotencyKey);
    const job = await queueByName(this.#queues, input.queueName).getJob(jobId);
    if (job === undefined) return undefined;

    return Object.freeze({
      queueName: input.queueName,
      jobName: job.name,
      jobId,
      state: await job.getState(),
      attemptsMade: job.attemptsMade,
    });
  }

  public async removeSettled(input: QueueJobIdentity): Promise<boolean> {
    const jobId = queueJobId(input.jobName, input.idempotencyKey);
    const job = await queueByName(this.#queues, input.queueName).getJob(jobId);
    if (job === undefined) return false;

    const state = await job.getState();
    if (state !== 'completed' && state !== 'failed') return false;
    await job.remove();
    return true;
  }

  public close(): Promise<void> {
    this.#closeTask ??= (async () => {
      try {
        await Promise.all(
          [...this.#queues.values()].map((queue) => queue.close())
        );
      } finally {
        await Promise.all(
          this.#connections.map((connection) => connection.close())
        );
      }
    })();
    return this.#closeTask;
  }
}

export class QueueWorkerPool implements QueueWorkerPoolContract {
  readonly #handler: QueueJobHandler;
  readonly #options: QueueInfrastructureOptions;
  #workers: readonly Worker<BaseJobEnvelope, void, string>[] = [];
  #connections: readonly ManagedQueueConnection[] = [];
  #startTask: Promise<void> | undefined;
  #closeTask: Promise<void> | undefined;

  public constructor(
    options: QueueInfrastructureOptions,
    handler: QueueJobHandler
  ) {
    normalizeRetryPolicy(options.retryPolicy);
    this.#options = options;
    this.#handler = handler;
  }

  public start(): Promise<void> {
    if (this.#closeTask !== undefined) {
      return Promise.reject(new Error('O pool de filas está encerrando.'));
    }
    this.#startTask ??= this.#start();
    return this.#startTask;
  }

  async #start(): Promise<void> {
    const prefix = queueKeyPrefix(this.#options.environment);
    const connections: ManagedQueueConnection[] = [];
    this.#workers = queueNames.map((queueName) => {
      const managedConnection = createQueueConnection(
        this.#options,
        queueName,
        'consumer'
      );
      connections.push(managedConnection);
      const worker = new Worker<BaseJobEnvelope, void, string>(
        queueName,
        (job) => this.#process(queueName, job),
        {
          connection: managedConnection.connection,
          prefix,
          concurrency: 1,
          maxStalledCount: 1,
        }
      );
      worker.on('error', () => {
        this.#options.logger.warn(
          { event: 'queue.worker.error', queue: queueName },
          'Falha segura no consumer da fila.'
        );
      });
      return worker;
    });
    this.#connections = connections;

    try {
      await Promise.all(this.#workers.map((worker) => worker.waitUntilReady()));
    } catch {
      await this.close();
      throw new Error('Não foi possível iniciar os consumers das filas.');
    }
  }

  async #process(
    queueName: QueueName,
    job: Job<BaseJobEnvelope, void, string>
  ): Promise<void> {
    let envelope: BaseJobEnvelope;
    if (job.id === undefined || !generatedJobIdPattern.test(job.id)) {
      throw new UnrecoverableError('INVALID_JOB_ID');
    }
    try {
      envelope = parseJobEnvelope(job.data);
    } catch {
      throw new UnrecoverableError('INVALID_JOB_ENVELOPE');
    }

    try {
      await this.#handler({
        queueName,
        jobName: job.name,
        jobId: job.id,
        envelope,
        attempt: job.attemptsMade + 1,
        maxAttempts: Math.max(job.opts.attempts ?? 1, 1),
      });
    } catch (error: unknown) {
      if (error instanceof QueueRetryableError) {
        throw new Error('RETRYABLE_JOB_FAILURE');
      }
      throw new UnrecoverableError('TERMINAL_JOB_FAILURE');
    }
  }

  public close(): Promise<void> {
    this.#closeTask ??= (async () => {
      try {
        await Promise.all(this.#workers.map((worker) => worker.close()));
      } finally {
        await Promise.all(
          this.#connections.map((connection) => connection.close())
        );
      }
    })();
    return this.#closeTask;
  }
}

export function createQueueProducer(
  options: QueueInfrastructureOptions
): QueueProducerContract {
  return new QueueProducer(options);
}

export function createQueueWorkerPool(
  options: QueueInfrastructureOptions,
  handler: QueueJobHandler
): QueueWorkerPoolContract {
  return new QueueWorkerPool(options, handler);
}
