import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { accounts } from './accounts.js';
import {
  createdAtColumn,
  optimisticLockVersionColumn,
  updatedAtColumn,
  uuidV7PrimaryKey,
} from './columns.js';
import { organizations } from './organizations.js';

export const authorizationConstraintNames = Object.freeze({
  roleCodeUnique: 'roles_code_key',
  roleCodeCheck: 'roles_code_check',
  roleSystemStateCheck: 'roles_system_state_check',
  roleVersionCheck: 'roles_version_check',
  permissionCodeUnique: 'permissions_code_key',
  permissionCodeCheck: 'permissions_code_check',
  rolePermissionsPrimaryKey: 'role_permissions_pkey',
  rolePermissionsRoleForeignKey: 'role_permissions_role_id_fkey',
  rolePermissionsPermissionForeignKey: 'role_permissions_permission_id_fkey',
  accountRolesAccountForeignKey: 'account_roles_account_id_fkey',
  accountRolesRoleForeignKey: 'account_roles_role_id_fkey',
  accountRolesOrganizationForeignKey: 'account_roles_organization_id_fkey',
  accountRolesContextUnique: 'account_roles_account_role_context_key',
  accountRolesScopeCheck: 'account_roles_scope_check',
});

export const authorizationIndexNames = Object.freeze({
  rolePermissionsPermission: 'role_permissions_permission_id_idx',
  accountRolesRole: 'account_roles_role_id_idx',
  accountRolesContextLookup: 'account_roles_context_lookup_idx',
});

export const roles = pgTable(
  'roles',
  {
    id: uuidV7PrimaryKey(),
    code: varchar('code', { length: 63 }).notNull(),
    isSystem: boolean('is_system').notNull(),
    isActive: boolean('is_active').notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    version: optimisticLockVersionColumn(),
  },
  (table) => [
    unique(authorizationConstraintNames.roleCodeUnique).on(table.code),
    check(
      authorizationConstraintNames.roleCodeCheck,
      sql`${table.code} ~ '^[a-z][a-z0-9_]{0,62}$'`
    ),
    check(
      authorizationConstraintNames.roleSystemStateCheck,
      sql`NOT ${table.isSystem} OR ${table.isActive}`
    ),
    check(
      authorizationConstraintNames.roleVersionCheck,
      sql`${table.version} > 0`
    ),
  ]
);

export const permissions = pgTable(
  'permissions',
  {
    id: uuidV7PrimaryKey(),
    code: varchar('code', { length: 127 }).notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    unique(authorizationConstraintNames.permissionCodeUnique).on(table.code),
    check(
      authorizationConstraintNames.permissionCodeCheck,
      sql`${table.code} ~ '^[a-z][a-z0-9_]{0,62}\\.[a-z][a-z0-9_]{0,62}$'`
    ),
  ]
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id').notNull(),
    permissionId: uuid('permission_id').notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    primaryKey({
      name: authorizationConstraintNames.rolePermissionsPrimaryKey,
      columns: [table.roleId, table.permissionId],
    }),
    foreignKey({
      name: authorizationConstraintNames.rolePermissionsRoleForeignKey,
      columns: [table.roleId],
      foreignColumns: [roles.id],
    })
      .onUpdate('no action')
      .onDelete('restrict'),
    foreignKey({
      name: authorizationConstraintNames.rolePermissionsPermissionForeignKey,
      columns: [table.permissionId],
      foreignColumns: [permissions.id],
    })
      .onUpdate('no action')
      .onDelete('restrict'),
    index(authorizationIndexNames.rolePermissionsPermission).on(
      table.permissionId
    ),
  ]
);

export const accountRoles = pgTable(
  'account_roles',
  {
    id: uuidV7PrimaryKey(),
    accountId: uuid('account_id').notNull(),
    roleId: uuid('role_id').notNull(),
    organizationId: uuid('organization_id'),
    organizationUnitId: uuid('organization_unit_id'),
    createdAt: createdAtColumn(),
  },
  (table) => [
    foreignKey({
      name: authorizationConstraintNames.accountRolesAccountForeignKey,
      columns: [table.accountId],
      foreignColumns: [accounts.id],
    })
      .onUpdate('no action')
      .onDelete('restrict'),
    foreignKey({
      name: authorizationConstraintNames.accountRolesRoleForeignKey,
      columns: [table.roleId],
      foreignColumns: [roles.id],
    })
      .onUpdate('no action')
      .onDelete('restrict'),
    foreignKey({
      name: authorizationConstraintNames.accountRolesOrganizationForeignKey,
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    })
      .onUpdate('no action')
      .onDelete('restrict'),
    unique(authorizationConstraintNames.accountRolesContextUnique)
      .on(
        table.accountId,
        table.roleId,
        table.organizationId,
        table.organizationUnitId
      )
      .nullsNotDistinct(),
    index(authorizationIndexNames.accountRolesRole).on(table.roleId),
    index(authorizationIndexNames.accountRolesContextLookup).on(
      table.accountId,
      table.organizationId,
      table.organizationUnitId,
      table.roleId
    ),
    check(
      authorizationConstraintNames.accountRolesScopeCheck,
      sql`${table.organizationUnitId} IS NULL OR ${table.organizationId} IS NOT NULL`
    ),
  ]
);

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
export type AccountRole = typeof accountRoles.$inferSelect;
export type NewAccountRole = typeof accountRoles.$inferInsert;

export function isRoleMutable(role: Pick<Role, 'isSystem'>): boolean {
  return !role.isSystem;
}
