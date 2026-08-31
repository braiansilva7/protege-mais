export const authSessionDeviceIdentifierMaximumLength = 128;
export const authSessionDeviceIdentifierPatternSource =
  '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$';
export const authSessionDeviceNameMaximumLength = 120;
export const authSessionRefreshTokenMaximumLength = 4_096;
export const authSessionUserAgentMaximumLength = 512;

const authSessionDeviceIdentifierPattern = new RegExp(
  authSessionDeviceIdentifierPatternSource,
  'u'
);

export function isValidAuthSessionDeviceIdentifier(value: string): boolean {
  return (
    value.length <= authSessionDeviceIdentifierMaximumLength &&
    authSessionDeviceIdentifierPattern.test(value)
  );
}

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
