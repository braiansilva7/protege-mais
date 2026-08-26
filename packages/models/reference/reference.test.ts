import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { conventionOwners, conventionRecords } from './index.js';

const uuidV7Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

void test('model de referência mapeia camelCase para snake_case', () => {
  const owners = getTableConfig(conventionOwners);
  const records = getTableConfig(conventionRecords);

  assert.equal(owners.name, 'convention_owners');
  assert.equal(records.name, 'convention_records');
  assert.deepEqual(
    records.columns.map((column) => column.name),
    [
      'id',
      'owner_id',
      'external_key',
      'optional_label',
      'created_at',
      'updated_at',
      'version',
      'deleted_at',
    ]
  );
  assert.equal(conventionRecords.ownerId.name, 'owner_id');
  assert.equal(conventionRecords.externalKey.name, 'external_key');
  assert.equal(conventionRecords.optionalLabel.name, 'optional_label');
});

void test('helpers aplicam UUID v7, TIMESTAMPTZ e nulabilidade', () => {
  assert.equal(conventionOwners.id.primary, true);
  assert.equal(conventionOwners.id.notNull, true);
  assert.equal(conventionOwners.id.default, undefined);
  assert.equal(typeof conventionOwners.id.defaultFn, 'function');

  const generatedId = conventionOwners.id.defaultFn?.();
  if (typeof generatedId !== 'string') {
    throw new TypeError('O default de id deve gerar uma string UUID v7.');
  }
  assert.match(generatedId, uuidV7Pattern);

  assert.equal(conventionRecords.createdAt.notNull, true);
  assert.equal(
    conventionRecords.createdAt.getSQLType(),
    'timestamp (3) with time zone'
  );
  assert.equal(conventionRecords.updatedAt.notNull, true);
  assert.equal(typeof conventionRecords.updatedAt.onUpdateFn, 'function');
  assert.equal(conventionRecords.version.notNull, true);
  assert.equal(conventionRecords.version.default, 1);
  assert.equal(conventionRecords.optionalLabel.notNull, false);
  assert.equal(conventionRecords.deletedAt.notNull, false);
  assert.equal(conventionRecords.deletedAt.default, undefined);
});

void test('constraints e índices usam nomes e ações explícitos', () => {
  const owners = getTableConfig(conventionOwners);
  const records = getTableConfig(conventionRecords);

  assert.deepEqual(
    owners.uniqueConstraints.map((constraint) => constraint.getName()),
    ['convention_owners_code_key']
  );
  assert.deepEqual(
    owners.checks.map((constraint) => constraint.name),
    ['convention_owners_version_check']
  );
  assert.deepEqual(
    records.checks.map((constraint) => constraint.name),
    ['convention_records_version_check']
  );

  assert.equal(records.foreignKeys.length, 1);
  assert.equal(
    records.foreignKeys[0]?.getName(),
    'convention_records_owner_id_fkey'
  );
  assert.equal(records.foreignKeys[0]?.onUpdate, 'no action');
  assert.equal(records.foreignKeys[0]?.onDelete, 'restrict');

  assert.deepEqual(
    records.indexes.map((databaseIndex) => databaseIndex.config.name).sort(),
    [
      'convention_records_owner_id_external_key_active_uidx',
      'convention_records_owner_id_idx',
    ]
  );
  const activeUniqueIndex = records.indexes.find(
    (databaseIndex) =>
      databaseIndex.config.name ===
      'convention_records_owner_id_external_key_active_uidx'
  );
  assert.equal(activeUniqueIndex?.config.unique, true);
  assert.ok(activeUniqueIndex?.config.where);
});

void test('migration de referência preserva o contrato exportado', async () => {
  const migration = await readFile(
    new URL(
      './atlas/20260826225016_conventions_reference.sql',
      import.meta.url
    ),
    'utf8'
  );

  assert.match(migration, /CREATE TABLE "public"\."convention_owners"/u);
  assert.match(migration, /"owner_id" uuid NOT NULL/u);
  assert.match(migration, /"optional_label" character varying\(160\) NULL/u);
  assert.match(
    migration,
    /"created_at" timestamptz\(3\) NOT NULL DEFAULT now\(\)/u
  );
  assert.match(migration, /"deleted_at" timestamptz\(3\) NULL/u);
  assert.doesNotMatch(migration, /"id" uuid NOT NULL DEFAULT/u);
  assert.match(migration, /CONSTRAINT "convention_records_owner_id_fkey"/u);
  assert.match(migration, /ON UPDATE NO ACTION ON DELETE RESTRICT/u);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "convention_records_owner_id_external_key_active_uidx"/u
  );
  assert.match(migration, /WHERE \(deleted_at IS NULL\)/u);
});
