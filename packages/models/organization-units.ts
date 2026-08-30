import {
  brazilianStateCodes,
  brazilianStateMunicipalityPrefixes,
  organizationUnitAddressComplementMaximumLength,
  organizationUnitAddressDistrictMaximumLength,
  organizationUnitAddressNumberMaximumLength,
  organizationUnitAddressStreetMaximumLength,
  organizationUnitCodeMaximumLength,
  organizationUnitContactEmailMaximumLength,
  organizationUnitNameMaximumLength,
  organizationUnitPhoneE164MaximumLength,
  organizationUnitPostalCodeLength,
  organizationUnitTypeMaximumLength,
} from '@protege-mais/common';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  customType,
  doublePrecision,
  foreignKey,
  index,
  pgTable,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  createdAtColumn,
  deletedAtColumn,
  optimisticLockVersionColumn,
  updatedAtColumn,
  uuidV7PrimaryKey,
} from './columns.js';
import { organizations, type Organization } from './organizations.js';

const stateCodeLiterals = brazilianStateCodes
  .map((stateCode) => `'${stateCode}'`)
  .join(', ');
const municipalityPrefixCases = Object.entries(
  brazilianStateMunicipalityPrefixes
)
  .map(([stateCode, prefix]) => `WHEN '${stateCode}' THEN '${prefix}'`)
  .join(' ');

export interface OrganizationUnitPosition {
  readonly longitude: number;
  readonly latitude: number;
}

/** Converte o EWKB retornado pelo PostGIS em longitude/latitude. */
export function parseOrganizationUnitPosition(
  hexadecimalEwkb: string
): OrganizationUnitPosition {
  if (
    hexadecimalEwkb.length % 2 !== 0 ||
    !/^[0-9a-f]+$/iu.test(hexadecimalEwkb)
  ) {
    throw new TypeError('A posição PostGIS não está em EWKB hexadecimal.');
  }

  const bytes = Uint8Array.from(
    { length: hexadecimalEwkb.length / 2 },
    (_, index) =>
      Number.parseInt(hexadecimalEwkb.slice(index * 2, index * 2 + 2), 16)
  );
  if (bytes.byteLength < 21) {
    throw new TypeError('A posição PostGIS está truncada.');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const byteOrder = view.getUint8(0);
  if (byteOrder !== 0 && byteOrder !== 1) {
    throw new TypeError('A posição PostGIS possui byte order inválido.');
  }

  const littleEndian = byteOrder === 1;
  const geometryType = view.getUint32(1, littleEndian);
  if ((geometryType & 0xff) !== 1) {
    throw new TypeError('A posição PostGIS não é um Point.');
  }

  const hasSrid = (geometryType & 0x20000000) !== 0;
  const coordinateOffset = hasSrid ? 9 : 5;
  if (bytes.byteLength < coordinateOffset + 16) {
    throw new TypeError('A posição PostGIS está truncada.');
  }
  if (hasSrid && view.getUint32(5, littleEndian) !== 4326) {
    throw new TypeError('A posição PostGIS não usa SRID 4326.');
  }

  return Object.freeze({
    longitude: view.getFloat64(coordinateOffset, littleEndian),
    latitude: view.getFloat64(coordinateOffset + 8, littleEndian),
  });
}

const geographyPoint = customType<{
  data: OrganizationUnitPosition;
  driverData: string;
}>({
  dataType: () => 'geography(Point,4326)',
  fromDriver: parseOrganizationUnitPosition,
});

export const organizationUnitConstraintNames = Object.freeze({
  organizationCodeUnique: 'organization_units_organization_id_code_key',
  organizationIdentityUnique: 'organization_units_organization_id_id_key',
  organizationForeignKey: 'organization_units_organization_id_fkey',
  nameNormalization: 'organization_units_name_normalization_check',
  code: 'organization_units_code_check',
  type: 'organization_units_type_check',
  contactEmail: 'organization_units_contact_email_check',
  contactPhone: 'organization_units_contact_phone_e164_check',
  addressNormalization: 'organization_units_address_normalization_check',
  postalCode: 'organization_units_postal_code_check',
  stateCode: 'organization_units_state_code_check',
  municipalityCode: 'organization_units_municipality_code_check',
  municipalityState: 'organization_units_municipality_state_check',
  longitude: 'organization_units_longitude_check',
  latitude: 'organization_units_latitude_check',
  version: 'organization_units_version_check',
});

export const organizationUnitIndexNames = Object.freeze({
  activeName: 'organization_units_organization_name_active_idx',
  position: 'organization_units_position_gix',
});

export const organizationUnits = pgTable(
  'organization_units',
  {
    id: uuidV7PrimaryKey(),
    organizationId: uuid('organization_id').notNull(),
    name: varchar('name', {
      length: organizationUnitNameMaximumLength,
    }).notNull(),
    nameNormalized: varchar('name_normalized', {
      length: organizationUnitNameMaximumLength,
    }).notNull(),
    code: varchar('code', {
      length: organizationUnitCodeMaximumLength,
    }).notNull(),
    type: varchar('type', {
      length: organizationUnitTypeMaximumLength,
    }).notNull(),
    contactEmail: varchar('contact_email', {
      length: organizationUnitContactEmailMaximumLength,
    }),
    contactPhoneE164: varchar('contact_phone_e164', {
      length: organizationUnitPhoneE164MaximumLength,
    }),
    addressStreet: varchar('address_street', {
      length: organizationUnitAddressStreetMaximumLength,
    }).notNull(),
    addressNumber: varchar('address_number', {
      length: organizationUnitAddressNumberMaximumLength,
    }).notNull(),
    addressComplement: varchar('address_complement', {
      length: organizationUnitAddressComplementMaximumLength,
    }),
    addressDistrict: varchar('address_district', {
      length: organizationUnitAddressDistrictMaximumLength,
    }).notNull(),
    postalCode: varchar('postal_code', {
      length: organizationUnitPostalCodeLength,
    }).notNull(),
    stateCode: varchar('state_code', { length: 2 }).notNull(),
    municipalityCode: varchar('municipality_code', { length: 7 }).notNull(),
    longitude: doublePrecision('longitude').notNull(),
    latitude: doublePrecision('latitude').notNull(),
    position: geographyPoint('position')
      .notNull()
      .generatedAlwaysAs(
        sql`ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography`
      ),
    isActive: boolean('is_active').notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    version: optimisticLockVersionColumn(),
    deletedAt: deletedAtColumn(),
  },
  (table) => [
    unique(organizationUnitConstraintNames.organizationCodeUnique).on(
      table.organizationId,
      table.code
    ),
    unique(organizationUnitConstraintNames.organizationIdentityUnique).on(
      table.organizationId,
      table.id
    ),
    foreignKey({
      name: organizationUnitConstraintNames.organizationForeignKey,
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    })
      .onUpdate('no action')
      .onDelete('restrict'),
    index(organizationUnitIndexNames.activeName)
      .on(table.organizationId, table.nameNormalized)
      .where(sql`${table.deletedAt} IS NULL AND ${table.isActive}`),
    index(organizationUnitIndexNames.position).using('gist', table.position),
    check(
      organizationUnitConstraintNames.nameNormalization,
      sql`char_length(${table.name}) > 0
        AND ${table.name} = btrim(${table.name})
        AND ${table.name} !~ '[[:cntrl:]]'
        AND ${table.name} !~ '[[:space:]]{2,}'
        AND ${table.nameNormalized} = lower(${table.name})`
    ),
    check(
      organizationUnitConstraintNames.code,
      sql`${table.code} = upper(btrim(${table.code}))
        AND ${table.code} ~ '^[A-Z0-9][A-Z0-9._-]{0,62}$'`
    ),
    check(
      organizationUnitConstraintNames.type,
      sql`${table.type} = lower(btrim(${table.type}))
        AND ${table.type} ~ '^[a-z][a-z0-9_]{0,62}$'`
    ),
    check(
      organizationUnitConstraintNames.contactEmail,
      sql`${table.contactEmail} IS NULL OR (
        ${table.contactEmail} = lower(btrim(${table.contactEmail}))
        AND ${table.contactEmail} ~ '^[^@[:space:]]+@[^@[:space:]]+$'
      )`
    ),
    check(
      organizationUnitConstraintNames.contactPhone,
      sql`${table.contactPhoneE164} IS NULL
        OR ${table.contactPhoneE164} ~ '^\\+[1-9][0-9]{1,14}$'`
    ),
    check(
      organizationUnitConstraintNames.addressNormalization,
      sql`char_length(${table.addressStreet}) > 0
        AND ${table.addressStreet} = btrim(${table.addressStreet})
        AND ${table.addressStreet} !~ '[[:cntrl:]]'
        AND ${table.addressStreet} !~ '[[:space:]]{2,}'
        AND char_length(${table.addressNumber}) > 0
        AND ${table.addressNumber} = btrim(${table.addressNumber})
        AND ${table.addressNumber} !~ '[[:cntrl:]]'
        AND ${table.addressNumber} !~ '[[:space:]]{2,}'
        AND (
          ${table.addressComplement} IS NULL OR (
            char_length(${table.addressComplement}) > 0
            AND ${table.addressComplement} = btrim(${table.addressComplement})
            AND ${table.addressComplement} !~ '[[:cntrl:]]'
            AND ${table.addressComplement} !~ '[[:space:]]{2,}'
          )
        )
        AND char_length(${table.addressDistrict}) > 0
        AND ${table.addressDistrict} = btrim(${table.addressDistrict})
        AND ${table.addressDistrict} !~ '[[:cntrl:]]'
        AND ${table.addressDistrict} !~ '[[:space:]]{2,}'`
    ),
    check(
      organizationUnitConstraintNames.postalCode,
      sql`${table.postalCode} ~ '^[0-9]{8}$'`
    ),
    check(
      organizationUnitConstraintNames.stateCode,
      sql`${table.stateCode} IN (${sql.raw(stateCodeLiterals)})`
    ),
    check(
      organizationUnitConstraintNames.municipalityCode,
      sql`${table.municipalityCode} ~ '^[0-9]{7}$'`
    ),
    check(
      organizationUnitConstraintNames.municipalityState,
      sql`${table.municipalityCode} !~ '^[0-9]{7}$' OR
        left(${table.municipalityCode}, 2) = CASE ${table.stateCode}
          ${sql.raw(municipalityPrefixCases)}
        END`
    ),
    check(
      organizationUnitConstraintNames.longitude,
      sql`${table.longitude} BETWEEN -180 AND 180`
    ),
    check(
      organizationUnitConstraintNames.latitude,
      sql`${table.latitude} BETWEEN -90 AND 90`
    ),
    check(organizationUnitConstraintNames.version, sql`${table.version} > 0`),
  ]
);

export type OrganizationUnit = typeof organizationUnits.$inferSelect;
export type NewOrganizationUnit = typeof organizationUnits.$inferInsert;

export const organizationUnitPublicSelection = Object.freeze({
  id: organizationUnits.id,
  organizationId: organizationUnits.organizationId,
  name: organizationUnits.name,
  code: organizationUnits.code,
  type: organizationUnits.type,
  isActive: organizationUnits.isActive,
  createdAt: organizationUnits.createdAt,
  updatedAt: organizationUnits.updatedAt,
  version: organizationUnits.version,
});

export type PublicOrganizationUnit = Readonly<
  Pick<OrganizationUnit, keyof typeof organizationUnitPublicSelection>
>;

export function serializePublicOrganizationUnit(
  unit: OrganizationUnit
): PublicOrganizationUnit {
  return Object.freeze({
    id: unit.id,
    organizationId: unit.organizationId,
    name: unit.name,
    code: unit.code,
    type: unit.type,
    isActive: unit.isActive,
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
    version: unit.version,
  });
}

export function isOrganizationUnitOperational(
  unit: Pick<OrganizationUnit, 'deletedAt' | 'isActive'>,
  organization: Pick<Organization, 'deletedAt' | 'isActive'>
): boolean {
  return (
    unit.isActive &&
    unit.deletedAt === null &&
    organization.isActive &&
    organization.deletedAt === null
  );
}
