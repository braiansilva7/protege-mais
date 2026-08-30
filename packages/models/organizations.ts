import {
  brazilianStateCodes,
  brazilianStateMunicipalityPrefixes,
  organizationCnpjLength,
  organizationLegalNameMaximumLength,
  organizationNameMaximumLength,
} from '@protege-mais/common';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  unique,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  createdAtColumn,
  deletedAtColumn,
  optimisticLockVersionColumn,
  updatedAtColumn,
  uuidV7PrimaryKey,
} from './columns.js';
import { organizationTypeEnum } from './enums.js';

const stateCodeLiterals = brazilianStateCodes
  .map((stateCode) => `'${stateCode}'`)
  .join(', ');
const municipalityPrefixCases = Object.entries(
  brazilianStateMunicipalityPrefixes
)
  .map(([stateCode, prefix]) => `WHEN '${stateCode}' THEN '${prefix}'`)
  .join(' ');

const firstCnpjCheckDigitSum = `
  (ascii(substr("cnpj", 1, 1)) - 48) * 5 +
  (ascii(substr("cnpj", 2, 1)) - 48) * 4 +
  (ascii(substr("cnpj", 3, 1)) - 48) * 3 +
  (ascii(substr("cnpj", 4, 1)) - 48) * 2 +
  (ascii(substr("cnpj", 5, 1)) - 48) * 9 +
  (ascii(substr("cnpj", 6, 1)) - 48) * 8 +
  (ascii(substr("cnpj", 7, 1)) - 48) * 7 +
  (ascii(substr("cnpj", 8, 1)) - 48) * 6 +
  (ascii(substr("cnpj", 9, 1)) - 48) * 5 +
  (ascii(substr("cnpj", 10, 1)) - 48) * 4 +
  (ascii(substr("cnpj", 11, 1)) - 48) * 3 +
  (ascii(substr("cnpj", 12, 1)) - 48) * 2
`;
const secondCnpjCheckDigitSum = `
  (ascii(substr("cnpj", 1, 1)) - 48) * 6 +
  (ascii(substr("cnpj", 2, 1)) - 48) * 5 +
  (ascii(substr("cnpj", 3, 1)) - 48) * 4 +
  (ascii(substr("cnpj", 4, 1)) - 48) * 3 +
  (ascii(substr("cnpj", 5, 1)) - 48) * 2 +
  (ascii(substr("cnpj", 6, 1)) - 48) * 9 +
  (ascii(substr("cnpj", 7, 1)) - 48) * 8 +
  (ascii(substr("cnpj", 8, 1)) - 48) * 7 +
  (ascii(substr("cnpj", 9, 1)) - 48) * 6 +
  (ascii(substr("cnpj", 10, 1)) - 48) * 5 +
  (ascii(substr("cnpj", 11, 1)) - 48) * 4 +
  (ascii(substr("cnpj", 12, 1)) - 48) * 3 +
  (ascii(substr("cnpj", 13, 1)) - 48) * 2
`;

export const organizationConstraintNames = Object.freeze({
  cnpjUnique: 'organizations_cnpj_key',
  nameNormalization: 'organizations_name_normalization_check',
  legalNameNormalization: 'organizations_legal_name_normalization_check',
  cnpjFormat: 'organizations_cnpj_format_check',
  cnpjCheckDigits: 'organizations_cnpj_check_digits_check',
  stateCode: 'organizations_state_code_check',
  municipalityCode: 'organizations_municipality_code_check',
  municipalityState: 'organizations_municipality_state_check',
  version: 'organizations_version_check',
});

export const organizationIndexNames = Object.freeze({
  activeName: 'organizations_name_normalized_active_idx',
  activeLegalName: 'organizations_legal_name_normalized_active_idx',
  activeMunicipality: 'organizations_state_municipality_active_idx',
});

export const organizations = pgTable(
  'organizations',
  {
    id: uuidV7PrimaryKey(),
    name: varchar('name', { length: organizationNameMaximumLength }).notNull(),
    nameNormalized: varchar('name_normalized', {
      length: organizationNameMaximumLength,
    }).notNull(),
    legalName: varchar('legal_name', {
      length: organizationLegalNameMaximumLength,
    }).notNull(),
    legalNameNormalized: varchar('legal_name_normalized', {
      length: organizationLegalNameMaximumLength,
    }).notNull(),
    type: organizationTypeEnum('type').notNull(),
    cnpj: varchar('cnpj', { length: organizationCnpjLength }).notNull(),
    stateCode: varchar('state_code', { length: 2 }).notNull(),
    municipalityCode: varchar('municipality_code', { length: 7 }).notNull(),
    isActive: boolean('is_active').notNull(),
    integrationEnabled: boolean('integration_enabled').notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    version: optimisticLockVersionColumn(),
    deletedAt: deletedAtColumn(),
  },
  (table) => [
    unique(organizationConstraintNames.cnpjUnique).on(table.cnpj),
    index(organizationIndexNames.activeName)
      .on(table.nameNormalized)
      .where(sql`${table.deletedAt} IS NULL AND ${table.isActive}`),
    index(organizationIndexNames.activeLegalName)
      .on(table.legalNameNormalized)
      .where(sql`${table.deletedAt} IS NULL AND ${table.isActive}`),
    index(organizationIndexNames.activeMunicipality)
      .on(table.stateCode, table.municipalityCode, table.nameNormalized)
      .where(sql`${table.deletedAt} IS NULL AND ${table.isActive}`),
    check(
      organizationConstraintNames.nameNormalization,
      sql`char_length(${table.name}) > 0
        AND ${table.name} = btrim(${table.name})
        AND ${table.name} !~ '[[:cntrl:]]'
        AND ${table.name} !~ '[[:space:]]{2,}'
        AND ${table.nameNormalized} = lower(${table.name})`
    ),
    check(
      organizationConstraintNames.legalNameNormalization,
      sql`char_length(${table.legalName}) > 0
        AND ${table.legalName} = btrim(${table.legalName})
        AND ${table.legalName} !~ '[[:cntrl:]]'
        AND ${table.legalName} !~ '[[:space:]]{2,}'
        AND ${table.legalNameNormalized} = lower(${table.legalName})`
    ),
    check(
      organizationConstraintNames.cnpjFormat,
      sql`${table.cnpj} ~ '^[0-9A-Z]{12}[0-9]{2}$'
        AND ${table.cnpj} <> '00000000000000'`
    ),
    check(
      organizationConstraintNames.cnpjCheckDigits,
      sql`${table.cnpj} !~ '^[0-9A-Z]{12}[0-9]{2}$' OR (
        (ascii(substr(${table.cnpj}, 13, 1)) - 48) =
          CASE
            WHEN mod(${sql.raw(firstCnpjCheckDigitSum)}, 11) < 2 THEN 0
            ELSE 11 - mod(${sql.raw(firstCnpjCheckDigitSum)}, 11)
          END
        AND
        (ascii(substr(${table.cnpj}, 14, 1)) - 48) =
          CASE
            WHEN mod(${sql.raw(secondCnpjCheckDigitSum)}, 11) < 2 THEN 0
            ELSE 11 - mod(${sql.raw(secondCnpjCheckDigitSum)}, 11)
          END
      )`
    ),
    check(
      organizationConstraintNames.stateCode,
      sql`${table.stateCode} IN (${sql.raw(stateCodeLiterals)})`
    ),
    check(
      organizationConstraintNames.municipalityCode,
      sql`${table.municipalityCode} ~ '^[0-9]{7}$'`
    ),
    check(
      organizationConstraintNames.municipalityState,
      sql`${table.municipalityCode} !~ '^[0-9]{7}$' OR
        left(${table.municipalityCode}, 2) = CASE ${table.stateCode}
          ${sql.raw(municipalityPrefixCases)}
        END`
    ),
    check(organizationConstraintNames.version, sql`${table.version} > 0`),
  ]
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export const organizationPublicSelection = Object.freeze({
  id: organizations.id,
  name: organizations.name,
  type: organizations.type,
  stateCode: organizations.stateCode,
  municipalityCode: organizations.municipalityCode,
  isActive: organizations.isActive,
  integrationEnabled: organizations.integrationEnabled,
  createdAt: organizations.createdAt,
  updatedAt: organizations.updatedAt,
  version: organizations.version,
});

export type PublicOrganization = Readonly<
  Pick<Organization, keyof typeof organizationPublicSelection>
>;

export function serializePublicOrganization(
  organization: Organization
): PublicOrganization {
  return Object.freeze({
    id: organization.id,
    name: organization.name,
    type: organization.type,
    stateCode: organization.stateCode,
    municipalityCode: organization.municipalityCode,
    isActive: organization.isActive,
    integrationEnabled: organization.integrationEnabled,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
    version: organization.version,
  });
}

export function isOrganizationOperational(
  organization: Pick<Organization, 'deletedAt' | 'isActive'>
): boolean {
  return organization.isActive && organization.deletedAt === null;
}
