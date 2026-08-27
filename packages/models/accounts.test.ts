import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  accountActiveIdentifierIndexNames,
  accountPublicSelection,
  accounts,
  serializePublicAccount,
  type Account,
} from './accounts.js';

const uuidV7Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

void test('accounts mapeia colunas e tipos sem defaults de negócio', () => {
  const table = getTableConfig(accounts);

  assert.equal(table.name, 'accounts');
  assert.deepEqual(
    table.columns.map((column) => column.name),
    [
      'id',
      'email',
      'email_normalized',
      'phone_e164',
      'password_hash',
      'external_provider',
      'external_subject',
      'type',
      'status',
      'mfa_enabled',
      'last_login_at',
      'created_at',
      'updated_at',
      'version',
      'deleted_at',
    ]
  );

  assert.equal(accounts.id.default, undefined);
  assert.equal(typeof accounts.id.defaultFn, 'function');
  const generatedId = accounts.id.defaultFn?.();
  if (typeof generatedId !== 'string') {
    throw new TypeError('O default de accounts.id deve gerar um UUID v7.');
  }
  assert.match(generatedId, uuidV7Pattern);
  assert.equal(accounts.type.notNull, true);
  assert.equal(accounts.type.default, undefined);
  assert.equal(accounts.status.notNull, true);
  assert.equal(accounts.status.default, undefined);
  assert.equal(accounts.mfaEnabled.notNull, true);
  assert.equal(accounts.mfaEnabled.default, undefined);
  assert.equal(accounts.lastLoginAt.notNull, false);
  assert.equal(
    accounts.lastLoginAt.getSQLType(),
    'timestamp (3) with time zone'
  );
  assert.equal(accounts.version.default, 1);
  assert.equal(accounts.deletedAt.notNull, false);
});

void test('accounts nomeia checks e unicidade parcial de identificadores', () => {
  const table = getTableConfig(accounts);

  assert.deepEqual(table.checks.map((constraint) => constraint.name).sort(), [
    'accounts_email_normalization_check',
    'accounts_external_identity_check',
    'accounts_identity_method_check',
    'accounts_password_hash_check',
    'accounts_phone_e164_check',
    'accounts_version_check',
  ]);

  assert.deepEqual(
    table.indexes.map((databaseIndex) => databaseIndex.config.name).sort(),
    Object.values(accountActiveIdentifierIndexNames).sort()
  );
  for (const databaseIndex of table.indexes) {
    assert.equal(databaseIndex.config.unique, true);
    assert.ok(databaseIndex.config.where);
    assert.ok(
      new TextEncoder().encode(databaseIndex.config.name ?? '').length <= 63
    );
  }
});

void test('projeção pública nunca serializa hashes ou chaves internas', () => {
  const now = new Date('2026-08-26T23:59:59.000Z');
  const account: Account = {
    id: '0198eefd-9fd0-7000-8000-000000000015',
    email: 'Person@example.com',
    emailNormalized: 'person@example.com',
    phoneE164: '+5511999999999',
    passwordHash: 'hash-interno-de-teste',
    externalProvider: null,
    externalSubject: null,
    type: 'person',
    status: 'active',
    mfaEnabled: false,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
    deletedAt: null,
  };

  const serialized = serializePublicAccount(account);

  assert.equal(Object.isFrozen(accountPublicSelection), true);
  assert.equal(Object.isFrozen(serialized), true);
  assert.deepEqual(
    Object.keys(serialized),
    Object.keys(accountPublicSelection)
  );
  assert.equal(Object.hasOwn(serialized, 'passwordHash'), false);
  assert.equal(Object.hasOwn(serialized, 'emailNormalized'), false);
  assert.equal(Object.hasOwn(serialized, 'externalSubject'), false);
  assert.equal(Object.hasOwn(serialized, 'deletedAt'), false);
  assert.doesNotMatch(JSON.stringify(serialized), /hash-interno-de-teste/u);
});

void test('migration accounts preserva o model sem seed ou defaults de negócio', async () => {
  const migration = await readFile(
    new URL(
      '../../atlas/prod/20260826233758_create_accounts.sql',
      import.meta.url
    ),
    'utf8'
  );

  assert.match(migration, /CREATE TABLE "public"\."accounts"/u);
  assert.match(migration, /"id" uuid NOT NULL/u);
  assert.doesNotMatch(migration, /"id" uuid NOT NULL DEFAULT/u);
  assert.match(migration, /"type" "public"\."account_type" NOT NULL/u);
  assert.match(migration, /"status" "public"\."account_status" NOT NULL/u);
  assert.doesNotMatch(migration, /"(?:type|status)"[^\n]+DEFAULT/u);
  assert.match(migration, /"last_login_at" timestamptz\(3\) NULL/u);
  assert.match(migration, /"deleted_at" timestamptz\(3\) NULL/u);
  assert.match(migration, /CONSTRAINT "accounts_identity_method_check"/u);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "accounts_email_normalized_active_uidx"/u
  );
  assert.match(migration, /WHERE \(\(deleted_at IS NULL\)/u);
  assert.doesNotMatch(migration, /\b(?:INSERT|COPY)\b/iu);
  assert.doesNotMatch(migration, /atlas\/seed/iu);
});
