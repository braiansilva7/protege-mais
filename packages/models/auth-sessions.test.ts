import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  authSessionConstraintNames,
  authSessionIndexNames,
  authSessionPublicSelection,
  authSessions,
  isAuthSessionActive,
  serializePublicAuthSession,
  type AuthSession,
} from './auth-sessions.js';

const uuidV7Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

void test('auth_sessions mapeia colunas, tempos e FK sem soft delete', () => {
  const table = getTableConfig(authSessions);

  assert.equal(table.name, 'auth_sessions');
  assert.deepEqual(
    table.columns.map((column) => column.name),
    [
      'id',
      'account_id',
      'refresh_token_hash',
      'device_identifier',
      'device_name',
      'ip_hash',
      'user_agent',
      'expires_at',
      'last_used_at',
      'revoked_at',
      'created_at',
      'updated_at',
      'version',
    ]
  );
  assert.equal(authSessions.id.default, undefined);
  assert.equal(typeof authSessions.id.defaultFn, 'function');
  const generatedId = authSessions.id.defaultFn?.();
  if (typeof generatedId !== 'string') {
    throw new TypeError('O default de auth_sessions.id deve gerar UUID v7.');
  }
  assert.match(generatedId, uuidV7Pattern);
  assert.equal(authSessions.accountId.notNull, true);
  assert.equal(authSessions.refreshTokenHash.notNull, true);
  assert.equal(authSessions.deviceIdentifier.notNull, true);
  assert.equal(authSessions.deviceName.notNull, false);
  assert.equal(authSessions.ipHash.notNull, false);
  assert.equal(authSessions.userAgent.notNull, false);
  assert.equal(authSessions.expiresAt.notNull, true);
  assert.equal(authSessions.lastUsedAt.notNull, false);
  assert.equal(authSessions.revokedAt.notNull, false);
  assert.equal(
    authSessions.expiresAt.getSQLType(),
    'timestamp (3) with time zone'
  );
  assert.equal(authSessions.version.default, 1);
  assert.equal('deletedAt' in authSessions, false);

  assert.equal(table.foreignKeys.length, 1);
  assert.equal(
    table.foreignKeys[0]?.getName(),
    authSessionConstraintNames.accountForeignKey
  );
  assert.equal(table.foreignKeys[0]?.onUpdate, 'no action');
  assert.equal(table.foreignKeys[0]?.onDelete, 'restrict');
});

void test('auth_sessions nomeia checks e índices de busca/revogação', () => {
  const table = getTableConfig(authSessions);

  assert.deepEqual(table.checks.map((constraint) => constraint.name).sort(), [
    'auth_sessions_device_identifier_check',
    'auth_sessions_device_name_check',
    'auth_sessions_ip_hash_check',
    'auth_sessions_lifecycle_check',
    'auth_sessions_refresh_token_hash_check',
    'auth_sessions_user_agent_check',
    'auth_sessions_version_check',
  ]);
  assert.deepEqual(
    table.indexes.map((databaseIndex) => databaseIndex.config.name).sort(),
    Object.values(authSessionIndexNames).sort()
  );
  const hashIndex = table.indexes.find(
    (databaseIndex) =>
      databaseIndex.config.name === authSessionIndexNames.refreshTokenHash
  );
  assert.equal(hashIndex?.config.unique, true);
  assert.equal(hashIndex?.config.where, undefined);
  for (const databaseObjectName of [
    ...Object.values(authSessionConstraintNames),
    ...Object.values(authSessionIndexNames),
    ...table.checks.map((constraint) => constraint.name),
  ]) {
    assert.ok(new TextEncoder().encode(databaseObjectName).length <= 63);
  }
});

void test('atividade exige prazo futuro e ausência de revogação', () => {
  const now = new Date('2026-08-27T00:00:00.000Z');

  assert.equal(
    isAuthSessionActive(
      { expiresAt: new Date('2026-08-27T00:00:00.001Z'), revokedAt: null },
      now
    ),
    true
  );
  assert.equal(
    isAuthSessionActive(
      { expiresAt: new Date('2026-08-27T00:00:00.000Z'), revokedAt: null },
      now
    ),
    false
  );
  assert.equal(
    isAuthSessionActive(
      {
        expiresAt: new Date('2026-08-28T00:00:00.000Z'),
        revokedAt: new Date('2026-08-26T23:00:00.000Z'),
      },
      now
    ),
    false
  );
});

void test('projeção pública nunca serializa hashes ou ownership interno', () => {
  const createdAt = new Date('2026-08-26T23:00:00.000Z');
  const session: AuthSession = {
    id: '0198eefd-9fd0-7000-8000-000000000016',
    accountId: '0198eefd-9fd0-7000-8000-000000000015',
    refreshTokenHash: 'refresh-hash-interno-de-teste',
    deviceIdentifier: 'device-test-016',
    deviceName: 'Dispositivo de teste',
    ipHash: 'ip-hash-interno-de-teste',
    userAgent: 'Browser/1.0 Test',
    expiresAt: new Date('2026-09-26T23:00:00.000Z'),
    lastUsedAt: null,
    revokedAt: null,
    createdAt,
    updatedAt: createdAt,
    version: 1,
  };

  const serialized = serializePublicAuthSession(session);

  assert.equal(Object.isFrozen(authSessionPublicSelection), true);
  assert.equal(Object.isFrozen(serialized), true);
  assert.deepEqual(
    Object.keys(serialized),
    Object.keys(authSessionPublicSelection)
  );
  assert.equal(Object.hasOwn(serialized, 'accountId'), false);
  assert.equal(Object.hasOwn(serialized, 'refreshTokenHash'), false);
  assert.equal(Object.hasOwn(serialized, 'ipHash'), false);
  assert.doesNotMatch(JSON.stringify(serialized), /hash-interno-de-teste/u);
});

void test('migration auth_sessions preserva o model sem token ou seed', async () => {
  const migrationDirectory = new URL('../../atlas/prod/', import.meta.url);
  const migrationNames = (await readdir(migrationDirectory)).filter((name) =>
    name.endsWith('_create_auth_sessions.sql')
  );
  assert.equal(migrationNames.length, 1);

  const migration = await readFile(
    new URL(migrationNames[0] ?? '', migrationDirectory),
    'utf8'
  );

  assert.match(migration, /CREATE TABLE "public"\."auth_sessions"/u);
  assert.match(
    migration,
    /"refresh_token_hash" character varying\(255\) NOT NULL/u
  );
  assert.match(migration, /CONSTRAINT "auth_sessions_account_id_fkey"/u);
  assert.match(migration, /ON UPDATE NO ACTION ON DELETE RESTRICT/u);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "auth_sessions_refresh_token_hash_uidx"/u
  );
  assert.match(
    migration,
    /CREATE INDEX "auth_sessions_account_id_revoked_at_expires_at_idx"/u
  );
  assert.doesNotMatch(migration, /"deleted_at"/u);
  assert.doesNotMatch(migration, /\b(?:INSERT|COPY)\b/iu);
  assert.doesNotMatch(migration, /atlas\/seed/iu);
});
