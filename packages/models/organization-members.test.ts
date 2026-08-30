import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  isOrganizationMemberActive,
  organizationMemberConstraintNames,
  organizationMemberIndexNames,
  organizationMemberPublicSelection,
  organizationMembers,
  serializePublicOrganizationMember,
  type OrganizationMember,
} from './organization-members.js';

const uuidV7Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

void test('organization_members mapeia contexto e vigência sem papel', () => {
  const table = getTableConfig(organizationMembers);

  assert.equal(table.name, 'organization_members');
  assert.deepEqual(
    table.columns.map((column) => column.name),
    [
      'id',
      'account_id',
      'organization_id',
      'organization_unit_id',
      'registration_number',
      'job_title',
      'is_active',
      'created_at',
      'updated_at',
      'version',
    ]
  );
  assert.equal('roleId' in organizationMembers, false);
  assert.equal('deletedAt' in organizationMembers, false);
  assert.equal(organizationMembers.id.default, undefined);
  assert.equal(typeof organizationMembers.id.defaultFn, 'function');
  const generatedId = organizationMembers.id.defaultFn?.();
  if (typeof generatedId !== 'string') {
    throw new TypeError('organization_members.id deve gerar UUID v7.');
  }
  assert.match(generatedId, uuidV7Pattern);
  assert.equal(organizationMembers.organizationUnitId.notNull, false);
  assert.equal(organizationMembers.registrationNumber.notNull, false);
  assert.equal(organizationMembers.jobTitle.notNull, false);
  assert.equal(organizationMembers.isActive.default, undefined);
  assert.equal(organizationMembers.version.default, 1);
});

void test('organization_members nomeia FKs, unicidade e índices', () => {
  const table = getTableConfig(organizationMembers);
  const contextUnique = table.uniqueConstraints[0];

  assert.equal(
    contextUnique?.getName(),
    organizationMemberConstraintNames.membershipContextUnique
  );
  assert.equal(contextUnique?.nullsNotDistinct, true);
  assert.deepEqual(
    contextUnique?.columns.map((column) => column.name),
    ['account_id', 'organization_id', 'organization_unit_id']
  );
  assert.deepEqual(
    table.foreignKeys.map((foreignKey) => foreignKey.getName()),
    [
      organizationMemberConstraintNames.accountForeignKey,
      organizationMemberConstraintNames.organizationForeignKey,
      organizationMemberConstraintNames.organizationUnitForeignKey,
    ]
  );
  for (const foreignKey of table.foreignKeys) {
    assert.equal(foreignKey.onUpdate, 'no action');
    assert.equal(foreignKey.onDelete, 'restrict');
  }
  assert.deepEqual(
    table.checks.map((constraint) => constraint.name).sort(),
    [
      organizationMemberConstraintNames.registrationNumber,
      organizationMemberConstraintNames.jobTitle,
      organizationMemberConstraintNames.version,
    ].sort()
  );
  assert.deepEqual(
    table.indexes.map((databaseIndex) => databaseIndex.config.name).sort(),
    Object.values(organizationMemberIndexNames).sort()
  );
  assert.ok(
    table.indexes.find(
      (databaseIndex) =>
        databaseIndex.config.name ===
        organizationMemberIndexNames.activeAccountContext
    )?.config.where
  );

  for (const databaseObjectName of [
    ...Object.values(organizationMemberConstraintNames),
    ...Object.values(organizationMemberIndexNames),
  ]) {
    assert.ok(new TextEncoder().encode(databaseObjectName).length <= 63);
  }
});

void test('projeção padrão omite matrícula institucional', () => {
  const now = new Date('2026-08-30T12:00:00.000Z');
  const member: OrganizationMember = {
    id: '01994b90-8100-7000-8000-000000000021',
    accountId: '01994b90-8100-7000-8000-000000000015',
    organizationId: '01994b90-8100-7000-8000-000000000019',
    organizationUnitId: '01994b90-8100-7000-8000-000000000020',
    registrationNumber: 'MAT-000021',
    jobTitle: 'Assistente Social',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  const serialized = serializePublicOrganizationMember(member);

  assert.equal(Object.isFrozen(organizationMemberPublicSelection), true);
  assert.equal(Object.isFrozen(serialized), true);
  assert.deepEqual(
    Object.keys(serialized),
    Object.keys(organizationMemberPublicSelection)
  );
  assert.equal(Object.hasOwn(serialized, 'registrationNumber'), false);
  assert.doesNotMatch(JSON.stringify(serialized), /MAT-000021/u);
});

void test('vínculo inativo não é vigente', () => {
  assert.equal(isOrganizationMemberActive({ isActive: true }), true);
  assert.equal(isOrganizationMemberActive({ isActive: false }), false);
});

void test('migration organization_members preserva contexto sem papel ou seed', async () => {
  const migrationDirectory = new URL('../../atlas/prod/', import.meta.url);
  const migrationNames = (await readdir(migrationDirectory)).filter((name) =>
    name.endsWith('_create_organization_members.sql')
  );
  assert.equal(migrationNames.length, 1);

  const migration = await readFile(
    new URL(migrationNames[0] ?? '', migrationDirectory),
    'utf8'
  );

  assert.match(migration, /CREATE TABLE "public"\."organization_members"/u);
  assert.match(migration, /UNIQUE NULLS NOT DISTINCT/u);
  assert.match(
    migration,
    /FOREIGN KEY \("organization_id", "organization_unit_id"\)/u
  );
  assert.doesNotMatch(migration, /"role_id"/u);
  assert.doesNotMatch(migration, /"deleted_at"/u);
  assert.doesNotMatch(migration, /"id" uuid NOT NULL DEFAULT/u);
  assert.doesNotMatch(migration, /\b(?:INSERT|COPY)\b/iu);
  assert.doesNotMatch(migration, /atlas\/seed/iu);
});
