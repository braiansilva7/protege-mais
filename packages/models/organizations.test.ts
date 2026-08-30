import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  isOrganizationOperational,
  organizationConstraintNames,
  organizationIndexNames,
  organizationPublicSelection,
  organizations,
  serializePublicOrganization,
  type Organization,
} from './organizations.js';

const uuidV7Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

void test('organizations mapeia dados institucionais sem defaults de negócio', () => {
  const table = getTableConfig(organizations);

  assert.equal(table.name, 'organizations');
  assert.deepEqual(
    table.columns.map((column) => column.name),
    [
      'id',
      'name',
      'name_normalized',
      'legal_name',
      'legal_name_normalized',
      'type',
      'cnpj',
      'state_code',
      'municipality_code',
      'is_active',
      'integration_enabled',
      'created_at',
      'updated_at',
      'version',
      'deleted_at',
    ]
  );

  assert.equal(organizations.id.default, undefined);
  assert.equal(typeof organizations.id.defaultFn, 'function');
  const generatedId = organizations.id.defaultFn?.();
  if (typeof generatedId !== 'string') {
    throw new TypeError('O default de organizations.id deve gerar um UUID v7.');
  }
  assert.match(generatedId, uuidV7Pattern);
  assert.equal(organizations.type.default, undefined);
  assert.equal(organizations.isActive.default, undefined);
  assert.equal(organizations.integrationEnabled.default, undefined);
  assert.equal(organizations.version.default, 1);
  assert.equal(organizations.deletedAt.notNull, false);
});

void test('organizations nomeia integridade, unicidade e índices ativos', () => {
  const table = getTableConfig(organizations);

  assert.deepEqual(
    table.uniqueConstraints.map((constraint) => constraint.getName()),
    [organizationConstraintNames.cnpjUnique]
  );
  assert.deepEqual(
    table.checks.map((constraint) => constraint.name).sort(),
    Object.values(organizationConstraintNames)
      .filter((name) => name !== organizationConstraintNames.cnpjUnique)
      .sort()
  );
  assert.deepEqual(
    table.indexes.map((databaseIndex) => databaseIndex.config.name).sort(),
    Object.values(organizationIndexNames).sort()
  );
  for (const databaseIndex of table.indexes) {
    assert.equal(databaseIndex.config.unique, false);
    assert.ok(databaseIndex.config.where);
  }
  for (const databaseObjectName of [
    ...Object.values(organizationConstraintNames),
    ...Object.values(organizationIndexNames),
  ]) {
    assert.ok(new TextEncoder().encode(databaseObjectName).length <= 63);
  }
});

void test('projeção padrão omite CNPJ, razão social e chaves internas', () => {
  const now = new Date('2026-08-30T12:00:00.000Z');
  const organization: Organization = {
    id: '01994b90-8100-7000-8000-000000000019',
    name: 'Instituto Proteção Integral',
    nameNormalized: 'instituto proteção integral',
    legalName: 'Instituto Proteção Integral de Teste',
    legalNameNormalized: 'instituto proteção integral de teste',
    type: 'nonprofit',
    cnpj: '12ABC34501DE35',
    stateCode: 'SP',
    municipalityCode: '3550308',
    isActive: true,
    integrationEnabled: false,
    createdAt: now,
    updatedAt: now,
    version: 1,
    deletedAt: null,
  };

  const serialized = serializePublicOrganization(organization);

  assert.equal(Object.isFrozen(organizationPublicSelection), true);
  assert.equal(Object.isFrozen(serialized), true);
  assert.deepEqual(
    Object.keys(serialized),
    Object.keys(organizationPublicSelection)
  );
  assert.equal(Object.hasOwn(serialized, 'cnpj'), false);
  assert.equal(Object.hasOwn(serialized, 'legalName'), false);
  assert.equal(Object.hasOwn(serialized, 'nameNormalized'), false);
  assert.equal(Object.hasOwn(serialized, 'deletedAt'), false);
  assert.doesNotMatch(JSON.stringify(serialized), /12ABC34501DE35/u);
});

void test('organização operacional exige ativa e não excluída', () => {
  assert.equal(
    isOrganizationOperational({ isActive: true, deletedAt: null }),
    true
  );
  assert.equal(
    isOrganizationOperational({ isActive: false, deletedAt: null }),
    false
  );
  assert.equal(
    isOrganizationOperational({
      isActive: true,
      deletedAt: new Date('2026-08-30T12:00:00.000Z'),
    }),
    false
  );
});

void test('migration organizations preserva model, CNPJ e FK contextual', async () => {
  const migrationDirectory = new URL('../../atlas/prod/', import.meta.url);
  const migrationNames = (await readdir(migrationDirectory)).filter((name) =>
    name.endsWith('_create_organizations.sql')
  );
  assert.equal(migrationNames.length, 1);

  const migration = await readFile(
    new URL(migrationNames[0] ?? '', migrationDirectory),
    'utf8'
  );

  assert.match(migration, /CREATE TABLE "public"\."organizations"/u);
  assert.match(migration, /"type" "public"\."organization_type" NOT NULL/u);
  assert.match(migration, /"cnpj" character varying\(14\) NOT NULL/u);
  assert.match(migration, /CONSTRAINT "organizations_cnpj_key" UNIQUE/u);
  assert.match(migration, /CONSTRAINT "organizations_cnpj_format_check"/u);
  assert.match(
    migration,
    /CONSTRAINT "account_roles_organization_id_fkey" FOREIGN KEY/u
  );
  assert.match(
    migration,
    /REFERENCES "public"\."organizations" \("id"\) ON UPDATE NO ACTION ON DELETE RESTRICT/u
  );
  assert.doesNotMatch(migration, /"id" uuid NOT NULL DEFAULT/u);
  assert.doesNotMatch(migration, /\b(?:INSERT|COPY)\b/iu);
  assert.doesNotMatch(migration, /atlas\/seed/iu);
});
