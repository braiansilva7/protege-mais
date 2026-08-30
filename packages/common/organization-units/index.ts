import {
  normalizeOrganizationMunicipalityCode,
  normalizeOrganizationName,
  normalizeOrganizationSearchText,
  normalizeOrganizationStateCode,
} from '../organizations/index.js';

export const organizationUnitNameMaximumLength = 160;
export const organizationUnitCodeMaximumLength = 63;
export const organizationUnitTypeMaximumLength = 63;
export const organizationUnitContactEmailMaximumLength = 320;
export const organizationUnitPhoneE164MaximumLength = 16;
export const organizationUnitAddressStreetMaximumLength = 255;
export const organizationUnitAddressNumberMaximumLength = 31;
export const organizationUnitAddressComplementMaximumLength = 160;
export const organizationUnitAddressDistrictMaximumLength = 160;
export const organizationUnitPostalCodeLength = 8;

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}

export function normalizeOrganizationUnitName(value: string): string {
  return normalizeOrganizationName(value);
}

export function normalizeOrganizationUnitSearchText(value: string): string {
  return normalizeOrganizationSearchText(value);
}

export function normalizeOrganizationUnitCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidOrganizationUnitCode(value: string): boolean {
  return /^[A-Z0-9][A-Z0-9._-]{0,62}$/u.test(value);
}

export function normalizeOrganizationUnitType(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidOrganizationUnitType(value: string): boolean {
  return /^[a-z][a-z0-9_]{0,62}$/u.test(value);
}

export function normalizeOrganizationUnitContactEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidOrganizationUnitContactEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+$/u.test(value);
}

export function normalizeOrganizationUnitPhoneE164(value: string): string {
  return value.trim();
}

export function isValidOrganizationUnitPhoneE164(value: string): boolean {
  return /^\+[1-9][0-9]{1,14}$/u.test(value);
}

export function normalizeOrganizationUnitAddressPart(value: string): string {
  return normalizeText(value);
}

export function normalizeOrganizationUnitPostalCode(value: string): string {
  return value.trim().replace(/[\s-]/gu, '');
}

export function isValidOrganizationUnitPostalCode(value: string): boolean {
  return /^[0-9]{8}$/u.test(value);
}

export const normalizeOrganizationUnitStateCode =
  normalizeOrganizationStateCode;
export const normalizeOrganizationUnitMunicipalityCode =
  normalizeOrganizationMunicipalityCode;

export function isValidOrganizationUnitPosition(
  longitude: number,
  latitude: number
): boolean {
  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
  );
}
