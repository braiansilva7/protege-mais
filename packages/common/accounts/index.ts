/**
 * Produz a chave canônica usada para busca e unicidade de e-mail de conta.
 * A validação de formato permanece na fronteira de entrada e no banco.
 */
export function normalizeAccountEmail(email: string): string {
  return email.trim().toLowerCase();
}
