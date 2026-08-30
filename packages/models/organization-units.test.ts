import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  isOrganizationUnitOperational,
  organizationUnitConstraintNames,
  organizationUnitIndexNames,
  organizationUnitPublicSelection,
  organizationUnits,
  parseOrganizationUnitPosition,
  serializePublicOrganizationUnit,
  type OrganizationUnit,
} from './organization-units.js';

const uuidV7Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function ewkbPoint(longitude: number, latitude: number, srid = 4326): string {
  const bytes = new Uint8Array(25);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, 1);
  view.setUint32(1, 0x20000001, true);
  view.setUint32(5, srid, true);
  view.setFloat64(9, longitude, true);
  view.setFloat64(17, latitude, true);

  return [...bytes]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

void test('organization_units mapeia endereço, contatos e posição gerada', () => {
  const table = getTableConfig(organizationUnits);

  assert.equal(table.name, 'organization_units');
  assert.deepEqual(
    table.columns.map((column) => column.name),
    [
      'id',
      'organization_id',
      'name',
      'name_normalized',
      'code',
      'type',
      'contact_email',
      'contact_phone_e164',
      'address_street',
      'address_number',
      'address_complement',
      'address_district',
      'postal_code',
      'state_code',
      'municipality_code',
      'longitude',
      'latitude',
      'position',
      'is_active',
      'created_at',
      'updated_at',
      'version',
      'deleted_at',
    ]
  );
  assert.equal(organizationUnits.id.default, undefined);
  assert.equal(typeof organizationUnits.id.defaultFn, 'function');
  const generatedId = organizationUnits.id.defaultFn?.();
  if (typeof generatedId !== 'string') {
    throw new TypeError(
      'O default de organization_units.id deve gerar UUID v7.'
    );
  }
  assert.match(generatedId, uuidV7Pattern);
  assert.equal(
    organizationUnits.position.getSQLType(),
    'geography(Point,4326)'
  );
  assert.equal(organizationUnits.position.notNull, true);
  assert.equal(organizationUnits.position.generated?.type, 'always');
  assert.equal(organizationUnits.position.generated?.mode, 'stored');
  assert.equal(organizationUnits.isActive.default, undefined);
  assert.equal(organizationUnits.version.default, 1);
  assert.equal(organizationUnits.deletedAt.notNull, false);
});

void test('organization_units nomeia integridade contextual e índices', () => {
  const table = getTableConfig(organizationUnits);

  assert.deepEqual(
    table.uniqueConstraints.map((constraint) => constraint.getName()).sort(),
    [
      organizationUnitConstraintNames.organizationCodeUnique,
      organizationUnitConstraintNames.organizationIdentityUnique,
    ].sort()
  );
  assert.deepEqual(
    table.foreignKeys.map((foreignKey) => foreignKey.getName()),
    [organizationUnitConstraintNames.organizationForeignKey]
  );
  assert.equal(table.foreignKeys[0]?.onUpdate, 'no action');
  assert.equal(table.foreignKeys[0]?.onDelete, 'restrict');
  assert.deepEqual(
    table.checks.map((constraint) => constraint.name).sort(),
    Object.values(organizationUnitConstraintNames)
      .filter(
        (name) =>
          name !== organizationUnitConstraintNames.organizationCodeUnique &&
          name !== organizationUnitConstraintNames.organizationIdentityUnique &&
          name !== organizationUnitConstraintNames.organizationForeignKey
      )
      .sort()
  );
  assert.deepEqual(
    table.indexes.map((databaseIndex) => databaseIndex.config.name).sort(),
    Object.values(organizationUnitIndexNames).sort()
  );
  assert.equal(
    table.indexes.find(
      (databaseIndex) =>
        databaseIndex.config.name === organizationUnitIndexNames.position
    )?.config.method,
    'gist'
  );
  assert.ok(
    table.indexes.find(
      (databaseIndex) =>
        databaseIndex.config.name === organizationUnitIndexNames.activeName
    )?.config.where
  );

  for (const databaseObjectName of [
    ...Object.values(organizationUnitConstraintNames),
    ...Object.values(organizationUnitIndexNames),
  ]) {
    assert.ok(new TextEncoder().encode(databaseObjectName).length <= 63);
  }
});

void test('posição EWKB preserva longitude, latitude e SRID 4326', () => {
  const position = parseOrganizationUnitPosition(
    ewkbPoint(-46.633_308, -23.550_52)
  );

  assert.deepEqual(position, {
    longitude: -46.633_308,
    latitude: -23.550_52,
  });
  assert.equal(Object.isFrozen(position), true);
  assert.throws(
    () => parseOrganizationUnitPosition(ewkbPoint(0, 0, 3857)),
    /SRID 4326/u
  );
  assert.throws(() => parseOrganizationUnitPosition('zz'), /EWKB/u);
  assert.throws(() => parseOrganizationUnitPosition('01'), /truncada/u);
});

void test('projeção padrão omite contato, endereço e localização', () => {
  const now = new Date('2026-08-30T12:00:00.000Z');
  const unit: OrganizationUnit = {
    id: '01994b90-8100-7000-8000-000000000020',
    organizationId: '01994b90-8100-7000-8000-000000000019',
    name: 'Unidade Centro',
    nameNormalized: 'unidade centro',
    code: 'CENTRO-01',
    type: 'service_center',
    contactEmail: 'plantao@example.test',
    contactPhoneE164: '+5511999999999',
    addressStreet: 'Avenida Proteção',
    addressNumber: '100',
    addressComplement: '2º andar',
    addressDistrict: 'Centro',
    postalCode: '01310100',
    stateCode: 'SP',
    municipalityCode: '3550308',
    longitude: -46.633_308,
    latitude: -23.550_52,
    position: { longitude: -46.633_308, latitude: -23.550_52 },
    isActive: true,
    createdAt: now,
    updatedAt: now,
    version: 1,
    deletedAt: null,
  };

  const serialized = serializePublicOrganizationUnit(unit);

  assert.equal(Object.isFrozen(organizationUnitPublicSelection), true);
  assert.equal(Object.isFrozen(serialized), true);
  assert.deepEqual(
    Object.keys(serialized),
    Object.keys(organizationUnitPublicSelection)
  );
  for (const omitted of [
    'contactEmail',
    'contactPhoneE164',
    'addressStreet',
    'postalCode',
    'longitude',
    'latitude',
    'position',
    'deletedAt',
  ]) {
    assert.equal(Object.hasOwn(serialized, omitted), false);
  }
  assert.doesNotMatch(JSON.stringify(serialized), /plantao|01310100|-46\.633/u);
});

void test('unidade operacional exige unidade e organização operacionais', () => {
  const active = { isActive: true, deletedAt: null };
  const inactive = { isActive: false, deletedAt: null };
  const deleted = {
    isActive: true,
    deletedAt: new Date('2026-08-30T12:00:00.000Z'),
  };

  assert.equal(isOrganizationUnitOperational(active, active), true);
  assert.equal(isOrganizationUnitOperational(inactive, active), false);
  assert.equal(isOrganizationUnitOperational(active, inactive), false);
  assert.equal(isOrganizationUnitOperational(deleted, active), false);
  assert.equal(isOrganizationUnitOperational(active, deleted), false);
});

void test('migration organization_units preserva geografia e contexto RBAC', async () => {
  const migrationDirectory = new URL('../../atlas/prod/', import.meta.url);
  const migrationNames = (await readdir(migrationDirectory)).filter((name) =>
    name.endsWith('_create_organization_units.sql')
  );
  assert.equal(migrationNames.length, 1);

  const migration = await readFile(
    new URL(migrationNames[0] ?? '', migrationDirectory),
    'utf8'
  );

  assert.match(migration, /CREATE TABLE "public"\."organization_units"/u);
  assert.match(migration, /geography\(Point,4326\)/u);
  assert.match(migration, /GENERATED ALWAYS AS/u);
  assert.match(migration, /organization_units_position_gix/u);
  assert.match(
    migration,
    /CONSTRAINT "account_roles_organization_id_organization_unit_id_fkey"/u
  );
  assert.match(
    migration,
    /FOREIGN KEY \("organization_id", "organization_unit_id"\)/u
  );
  assert.doesNotMatch(migration, /"id" uuid NOT NULL DEFAULT/u);
  assert.doesNotMatch(migration, /\b(?:INSERT|COPY)\b/iu);
  assert.doesNotMatch(migration, /atlas\/seed/iu);
});
