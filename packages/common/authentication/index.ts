export const authenticationPasswordMinimumLength = 15;
export const authenticationPasswordMaximumLength = 128;
export const authenticationEmailMaximumLength = 320;

const controlCharacterPattern = /[\u0000-\u001f\u007f-\u009f]/u;
const normalizedEmailPattern = /^[^@\s]+@[^@\s]+$/u;

/**
 * Aplica somente NFC. Senhas não recebem trim, lowercase ou truncamento.
 */
export function normalizeAuthenticationPassword(password: string): string {
  return password.normalize('NFC');
}

/**
 * Política para criação/troca futura; o login não usa o mínimo como atalho.
 */
export function isValidNewAuthenticationPassword(password: string): boolean {
  const normalizedPassword = normalizeAuthenticationPassword(password);
  const length = [...normalizedPassword].length;

  return (
    password === normalizedPassword &&
    normalizedPassword.trim().length > 0 &&
    length >= authenticationPasswordMinimumLength &&
    length <= authenticationPasswordMaximumLength &&
    !controlCharacterPattern.test(normalizedPassword)
  );
}

export function isAuthenticationPasswordWithinMaximumLength(
  password: string
): boolean {
  return (
    [...normalizeAuthenticationPassword(password)].length <=
    authenticationPasswordMaximumLength
  );
}

export function isAuthenticationEmailLookupCandidate(email: string): boolean {
  return (
    email.length > 0 &&
    [...email].length <= authenticationEmailMaximumLength &&
    normalizedEmailPattern.test(email)
  );
}
