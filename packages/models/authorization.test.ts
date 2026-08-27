import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  accountRoles,
  authorizationConstraintNames,
  authorizationIndexNames,
  isRoleMutable,
  permissions,
  rolePermissions,
  roles,
} from './authorization.js';

const uuidV7Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

void test('RBAC mapeia catálogos e relações sem defaults de negócio', () => {
  assert.deepEqual(
    getTableConfig(roles).columns.map((column) => column.name),
    [
      'id',
      'code',
      'is_system',
      'is_active',
      'created_at',
      'updated_at',
      'version',
    ]
  );
  assert.deepEqual(
    getTableConfig(permissions).columns.map((column) => column.name),
    ['id', 'code', 'created_at']
  );
  assert.deepEqual(
    getTableConfig(rolePermissions).columns.map((column) => column.name),
    ['role_id', 'permission_id', 'created_at']
  );
  assert.deepEqual(
    getTableConfig(accountRoles).columns.map((column) => column.name),
    [
      'id',
      'account_id',
      'role_id',
      'organization_id',
      'organization_unit_id',
      'created_at',
    ]
  );

  for (const identifier of [roles.id, permissions.id, accountRoles.id]) {
    assert.equal(identifier.default, undefined);
    assert.equal(typeof identifier.defaultFn, 'function');
    const generatedId = identifier.defaultFn?.();
    if (typeof generatedId !== 'string') {
      throw new TypeError('IDs do RBAC devem ser gerados como UUID v7.');
    }
    assert.match(generatedId, uuidV7Pattern);
  }

  assert.equal(roles.isSystem.default, undefined);
  assert.equal(roles.isActive.default, undefined);
  assert.equal(roles.version.default, 1);
  assert.equal(accountRoles.organizationId.notNull, false);
  assert.equal(accountRoles.organizationUnitId.notNull, false);
  for (const table of [roles, permissions, rolePermissions, accountRoles]) {
    assert.equal('deletedAt' in table, false);
  }
});

void test('RBAC nomeia unicidade, checks e chaves estrangeiras restritivas', () => {
  const roleConfiguration = getTableConfig(roles);
  const permissionConfiguration = getTableConfig(permissions);
  const rolePermissionConfiguration = getTableConfig(rolePermissions);
  const accountRoleConfiguration = getTableConfig(accountRoles);

  assert.deepEqual(
    roleConfiguration.uniqueConstraints.map((constraint) =>
      constraint.getName()
    ),
    [authorizationConstraintNames.roleCodeUnique]
  );
  assert.deepEqual(
    roleConfiguration.checks.map((constraint) => constraint.name).sort(),
    [
      authorizationConstraintNames.roleCodeCheck,
      authorizationConstraintNames.roleSystemStateCheck,
      authorizationConstraintNames.roleVersionCheck,
    ].sort()
  );
  assert.deepEqual(
    permissionConfiguration.uniqueConstraints.map((constraint) =>
      constraint.getName()
    ),
    [authorizationConstraintNames.permissionCodeUnique]
  );
  assert.deepEqual(
    permissionConfiguration.checks.map((constraint) => constraint.name),
    [authorizationConstraintNames.permissionCodeCheck]
  );
  assert.equal(rolePermissionConfiguration.primaryKeys.length, 1);
  assert.equal(
    rolePermissionConfiguration.primaryKeys[0]?.getName(),
    authorizationConstraintNames.rolePermissionsPrimaryKey
  );

  const foreignKeys = [
    ...rolePermissionConfiguration.foreignKeys,
    ...accountRoleConfiguration.foreignKeys,
  ];
  assert.deepEqual(
    foreignKeys.map((foreignKey) => foreignKey.getName()).sort(),
    [
      authorizationConstraintNames.rolePermissionsRoleForeignKey,
      authorizationConstraintNames.rolePermissionsPermissionForeignKey,
      authorizationConstraintNames.accountRolesAccountForeignKey,
      authorizationConstraintNames.accountRolesRoleForeignKey,
    ].sort()
  );
  for (const foreignKey of foreignKeys) {
    assert.equal(foreignKey.onUpdate, 'no action');
    assert.equal(foreignKey.onDelete, 'restrict');
  }

  assert.deepEqual(
    accountRoleConfiguration.foreignKeys.map((foreignKey) =>
      foreignKey.getName()
    ),
    [
      authorizationConstraintNames.accountRolesAccountForeignKey,
      authorizationConstraintNames.accountRolesRoleForeignKey,
    ]
  );
});

void test('atribuição contextual trata NULL como igual e possui índices de consulta', () => {
  const rolePermissionConfiguration = getTableConfig(rolePermissions);
  const accountRoleConfiguration = getTableConfig(accountRoles);
  const contextUnique = accountRoleConfiguration.uniqueConstraints.find(
    (constraint) =>
      constraint.getName() ===
      authorizationConstraintNames.accountRolesContextUnique
  );

  assert.equal(contextUnique?.nullsNotDistinct, true);
  assert.deepEqual(
    contextUnique?.columns.map((column) => column.name),
    ['account_id', 'role_id', 'organization_id', 'organization_unit_id']
  );
  assert.deepEqual(
    accountRoleConfiguration.checks.map((constraint) => constraint.name),
    [authorizationConstraintNames.accountRolesScopeCheck]
  );
  assert.deepEqual(
    rolePermissionConfiguration.indexes.map(
      (databaseIndex) => databaseIndex.config.name
    ),
    [authorizationIndexNames.rolePermissionsPermission]
  );
  assert.deepEqual(
    accountRoleConfiguration.indexes
      .map((databaseIndex) => databaseIndex.config.name)
      .sort(),
    [
      authorizationIndexNames.accountRolesRole,
      authorizationIndexNames.accountRolesContextLookup,
    ].sort()
  );

  for (const databaseObjectName of [
    ...Object.values(authorizationConstraintNames),
    ...Object.values(authorizationIndexNames),
  ]) {
    assert.ok(new TextEncoder().encode(databaseObjectName).length <= 63);
  }
});

void test('papel de sistema é identificado como não mutável', () => {
  assert.equal(isRoleMutable({ isSystem: true }), false);
  assert.equal(isRoleMutable({ isSystem: false }), true);
});

void test('migration RBAC preserva relações e não inclui catálogo ou seed', async () => {
  const migrationDirectory = new URL('../../atlas/prod/', import.meta.url);
  const migrationNames = (await readdir(migrationDirectory)).filter((name) =>
    name.endsWith('_create_authorization_structure.sql')
  );
  assert.equal(migrationNames.length, 1);

  const migration = await readFile(
    new URL(migrationNames[0] ?? '', migrationDirectory),
    'utf8'
  );

  for (const tableName of [
    'roles',
    'permissions',
    'role_permissions',
    'account_roles',
  ]) {
    assert.match(
      migration,
      new RegExp(`CREATE TABLE "public"\\."${tableName}"`, 'u')
    );
  }
  assert.match(migration, /UNIQUE NULLS NOT DISTINCT/u);
  assert.match(migration, /CONSTRAINT "account_roles_scope_check"/u);
  assert.match(migration, /ON UPDATE NO ACTION ON DELETE RESTRICT/u);
  assert.doesNotMatch(migration, /REFERENCES "public"\."organizations"/u);
  assert.doesNotMatch(migration, /REFERENCES "public"\."organization_units"/u);
  assert.doesNotMatch(migration, /"id" uuid NOT NULL DEFAULT/u);
  assert.doesNotMatch(migration, /\b(?:INSERT|COPY)\b/iu);
  assert.doesNotMatch(migration, /atlas\/seed/iu);
});
