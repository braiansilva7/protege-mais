export interface JobExecutionContext {
  readonly requestId: string;
  readonly correlationId: string;
  readonly jobId: string;
  readonly queueName: string;
  readonly jobName: string;
  readonly attempt: number;
  readonly maxAttempts: number;
}

export interface JobUseCase {
  execute(
    payload: Readonly<Record<string, unknown>>,
    context: JobExecutionContext
  ): Promise<void>;
}

export interface JobUseCaseDefinition {
  readonly name: string;
  readonly useCase: JobUseCase;
}

export class RetryableJobError extends Error {
  public readonly code = 'RETRYABLE_JOB_ERROR';

  public constructor(cause?: unknown) {
    super(
      'A execução do job falhou de forma transitória.',
      cause === undefined ? undefined : { cause }
    );
    this.name = 'RetryableJobError';
  }
}

export class TerminalJobError extends Error {
  public readonly code = 'TERMINAL_JOB_ERROR';

  public constructor(cause?: unknown) {
    super(
      'A execução do job falhou de forma terminal.',
      cause === undefined ? undefined : { cause }
    );
    this.name = 'TerminalJobError';
  }
}

export class JobUseCaseRegistry {
  readonly #useCases = new Map<string, JobUseCase>();

  public constructor(definitions: readonly JobUseCaseDefinition[] = []) {
    for (const definition of definitions) {
      this.register(definition);
    }
  }

  public register(definition: JobUseCaseDefinition): void {
    if (definition.name.length === 0) {
      throw new RangeError('O nome do job não pode ser vazio.');
    }
    if (this.#useCases.has(definition.name)) {
      throw new Error('O caso de uso do job já foi registrado.');
    }

    this.#useCases.set(definition.name, definition.useCase);
  }

  public resolve(name: string): JobUseCase | undefined {
    return this.#useCases.get(name);
  }
}
