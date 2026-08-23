export function postgresErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' &&
    error &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : undefined;
}
