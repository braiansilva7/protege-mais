/**
 * Fixture exclusivo para validar as convenções Drizzle/Atlas.
 * Não exportar pelo schema de produção nem usar como entidade de domínio.
 */
import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgTable,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  createdAtColumn,
  deletedAtColumn,
  optimisticLockVersionColumn,
  updatedAtColumn,
  uuidV7PrimaryKey,
} from '../columns.js';

export const conventionOwners = pgTable(
  'convention_owners',
  {
    id: uuidV7PrimaryKey(),
    code: varchar('code', { length: 64 }).notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    version: optimisticLockVersionColumn(),
  },
  (table) => [
    unique('convention_owners_code_key').on(table.code),
    check('convention_owners_version_check', sql`${table.version} > 0`),
  ]
);

export const conventionRecords = pgTable(
  'convention_records',
  {
    id: uuidV7PrimaryKey(),
    ownerId: uuid('owner_id').notNull(),
    externalKey: varchar('external_key', { length: 120 }).notNull(),
    optionalLabel: varchar('optional_label', { length: 160 }),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    version: optimisticLockVersionColumn(),
    deletedAt: deletedAtColumn(),
  },
  (table) => [
    foreignKey({
      name: 'convention_records_owner_id_fkey',
      columns: [table.ownerId],
      foreignColumns: [conventionOwners.id],
    })
      .onUpdate('no action')
      .onDelete('restrict'),
    index('convention_records_owner_id_idx').on(table.ownerId),
    uniqueIndex('convention_records_owner_id_external_key_active_uidx')
      .on(table.ownerId, table.externalKey)
      .where(sql`${table.deletedAt} IS NULL`),
    check('convention_records_version_check', sql`${table.version} > 0`),
  ]
);
