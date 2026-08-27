export const authSessionDeviceNameMaximumLength = 120;
export const authSessionUserAgentMaximumLength = 512;

function sanitizeAuthSessionText(
  value: string | null | undefined,
  maximumLength: number
): string | null {
  if (value === null || value === undefined) return null;

  const sanitized = value
    .replace(/[\u0000-\u001f\u007f]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

  if (sanitized.length === 0) return null;
  return [...sanitized].slice(0, maximumLength).join('');
}

/**
 * Minimiza um nome de dispositivo antes da persistência ou apresentação.
 */
export function sanitizeAuthSessionDeviceName(
  value: string | null | undefined
): string | null {
  return sanitizeAuthSessionText(value, authSessionDeviceNameMaximumLength);
}

/**
 * Remove controles, normaliza espaços e limita o User-Agent persistido.
 */
export function sanitizeAuthSessionUserAgent(
  value: string | null | undefined
): string | null {
  return sanitizeAuthSessionText(value, authSessionUserAgentMaximumLength);
}
