export const organizationMemberRegistrationNumberMaximumLength = 63;
export const organizationMemberJobTitleMaximumLength = 160;

const controlCharacterPattern = /[\u0000-\u001f\u007f-\u009f]/u;

function normalizeOrganizationMemberText(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}

function isValidNormalizedText(value: string, maximumLength: number): boolean {
  return (
    value.length > 0 &&
    [...value].length <= maximumLength &&
    !controlCharacterPattern.test(value) &&
    value === normalizeOrganizationMemberText(value)
  );
}

/** Preserva o identificador institucional e normaliza somente whitespace. */
export function normalizeOrganizationMemberRegistrationNumber(
  value: string
): string {
  return normalizeOrganizationMemberText(value);
}

export function isValidOrganizationMemberRegistrationNumber(
  value: string
): boolean {
  return isValidNormalizedText(
    value,
    organizationMemberRegistrationNumberMaximumLength
  );
}

/** Preserva caixa e acentos do cargo para apresentação. */
export function normalizeOrganizationMemberJobTitle(value: string): string {
  return normalizeOrganizationMemberText(value);
}

export function isValidOrganizationMemberJobTitle(value: string): boolean {
  return isValidNormalizedText(value, organizationMemberJobTitleMaximumLength);
}
