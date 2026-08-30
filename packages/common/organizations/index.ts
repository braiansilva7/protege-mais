export const organizationNameMaximumLength = 160;
export const organizationLegalNameMaximumLength = 255;
export const organizationCnpjLength = 14;

export const brazilianStateMunicipalityPrefixes = Object.freeze({
  AC: '12',
  AL: '27',
  AP: '16',
  AM: '13',
  BA: '29',
  CE: '23',
  DF: '53',
  ES: '32',
  GO: '52',
  MA: '21',
  MT: '51',
  MS: '50',
  MG: '31',
  PA: '15',
  PB: '25',
  PR: '41',
  PE: '26',
  PI: '22',
  RJ: '33',
  RN: '24',
  RS: '43',
  RO: '11',
  RR: '14',
  SC: '42',
  SP: '35',
  SE: '28',
  TO: '17',
} as const);

export type BrazilianStateCode =
  keyof typeof brazilianStateMunicipalityPrefixes;

export const brazilianStateCodes = Object.freeze(
  Object.keys(brazilianStateMunicipalityPrefixes) as BrazilianStateCode[]
);

const firstCnpjCheckDigitWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const secondCnpjCheckDigitWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}

function calculateCnpjCheckDigit(value: string, weights: number[]): number {
  const sum = [...value].reduce((total, character, index) => {
    const weight = weights[index];
    if (weight === undefined) {
      throw new RangeError('Peso ausente no cálculo do CNPJ.');
    }

    return total + (character.charCodeAt(0) - 48) * weight;
  }, 0);
  const remainder = sum % 11;

  return remainder < 2 ? 0 : 11 - remainder;
}

/** Normaliza espaçamento sem alterar a apresentação institucional. */
export function normalizeOrganizationName(value: string): string {
  return normalizeWhitespace(value);
}

/** Produz a chave canônica de busca para nome e razão social. */
export function normalizeOrganizationSearchText(value: string): string {
  return normalizeOrganizationName(value).toLowerCase();
}

/**
 * Remove a máscara e normaliza letras para o formato canônico de 14 posições.
 * A validação permanece separada para não transformar entrada inválida em válida.
 */
export function normalizeOrganizationCnpj(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[./\s-]/gu, '');
}

export function isValidOrganizationCnpj(value: string): boolean {
  const normalized = normalizeOrganizationCnpj(value);
  if (
    !/^[0-9A-Z]{12}[0-9]{2}$/u.test(normalized) ||
    normalized === '00000000000000'
  ) {
    return false;
  }

  const firstCheckDigit = calculateCnpjCheckDigit(
    normalized.slice(0, 12),
    firstCnpjCheckDigitWeights
  );
  const secondCheckDigit = calculateCnpjCheckDigit(
    `${normalized.slice(0, 12)}${firstCheckDigit}`,
    secondCnpjCheckDigitWeights
  );

  return normalized.endsWith(`${firstCheckDigit}${secondCheckDigit}`);
}

export function normalizeOrganizationStateCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isBrazilianStateCode(
  value: string
): value is BrazilianStateCode {
  return Object.hasOwn(brazilianStateMunicipalityPrefixes, value);
}

export function normalizeOrganizationMunicipalityCode(value: string): string {
  return value.trim();
}

export function isValidOrganizationMunicipalityCode(
  value: string,
  stateCode: string
): boolean {
  const normalizedStateCode = normalizeOrganizationStateCode(stateCode);
  const normalizedMunicipalityCode =
    normalizeOrganizationMunicipalityCode(value);

  return (
    isBrazilianStateCode(normalizedStateCode) &&
    /^[0-9]{7}$/u.test(normalizedMunicipalityCode) &&
    normalizedMunicipalityCode.startsWith(
      brazilianStateMunicipalityPrefixes[normalizedStateCode]
    )
  );
}
