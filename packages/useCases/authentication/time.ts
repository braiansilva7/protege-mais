export function authenticationTokenIssuedAt(value: Date): Date {
  return new Date(Math.floor(value.getTime() / 1_000) * 1_000);
}
