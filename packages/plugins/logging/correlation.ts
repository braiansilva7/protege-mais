import { createUuidV7 } from '@protege-mais/common';

export const requestIdHeader = 'x-request-id';
export const correlationIdHeader = 'x-correlation-id';

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export type CorrelationHeaderValue = string | readonly string[] | undefined;

export interface CorrelationContext {
  readonly requestId: string;
  readonly correlationId: string;
}

export interface CorrelationInput {
  readonly requestId?: CorrelationHeaderValue;
  readonly correlationId?: CorrelationHeaderValue;
}

export interface CorrelationMetadata {
  readonly correlationId: string;
}

export type IdentifierGenerator = () => string;

export function validCorrelationIdentifier(value: unknown) {
  return typeof value === 'string' && identifierPattern.test(value)
    ? value
    : undefined;
}

function generateIdentifier(generator: IdentifierGenerator) {
  try {
    const generated = validCorrelationIdentifier(generator());
    if (generated !== undefined) return generated;
  } catch {
    // O fallback local evita que um gerador injetado derrube o request.
  }

  return createUuidV7();
}

export function createCorrelationContext(
  input: CorrelationInput = {},
  generate: IdentifierGenerator = createUuidV7
): CorrelationContext {
  const requestId =
    validCorrelationIdentifier(input.requestId) ?? generateIdentifier(generate);
  const correlationId =
    validCorrelationIdentifier(input.correlationId) ?? requestId;

  return Object.freeze({ requestId, correlationId });
}

export function correlationMetadata(
  context: Pick<CorrelationContext, 'correlationId'>
): CorrelationMetadata {
  return Object.freeze({ correlationId: context.correlationId });
}

export function createWorkerCorrelationContext(
  metadata: Partial<CorrelationMetadata> = {},
  generate: IdentifierGenerator = createUuidV7
): CorrelationContext {
  return createCorrelationContext(
    { correlationId: metadata.correlationId },
    generate
  );
}
