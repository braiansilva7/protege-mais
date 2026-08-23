import {
  boolean,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from '@core/models/user/user.model.js';

export const permissionRoles = pgTable('permission_roles', {
  id: uuid('id').primaryKey(),
  code: varchar('code', { length: 60 }).unique(),
  name: varchar('name', { length: 120 }).notNull().unique(),
  description: text('description'),
  is_system: boolean('is_system').default(false).notNull(),
  active: boolean('active').default(true).notNull(),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .defaultNow()
    .notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .defaultNow()
    .notNull(),
});
export const permissions = pgTable('permissions', {
  action: varchar('action', { length: 100 }).primaryKey(),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .defaultNow()
    .notNull(),
});
export const permissionRoleActions = pgTable(
  'permission_role_actions',
  {
    permission_role_id: uuid('permission_role_id')
      .references(() => permissionRoles.id, { onDelete: 'cascade' })
      .notNull(),
    action: varchar('action', { length: 100 })
      .references(() => permissions.action, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.permission_role_id, table.action] })]
);
export const permissionAssignments = pgTable('permission_assignments', {
  user_id: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .primaryKey(),
  permission_role_id: uuid('permission_role_id')
    .references(() => permissionRoles.id, { onDelete: 'restrict' })
    .notNull(),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .defaultNow()
    .notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .defaultNow()
    .notNull(),
});
