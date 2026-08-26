import { createUuidV7 } from '@protege-mais/common';
import { integer, timestamp, uuid } from 'drizzle-orm/pg-core';

const timestampConfiguration = {
  mode: 'date',
  precision: 3,
  withTimezone: true,
} as const;

export function uuidV7PrimaryKey() {
  return uuid('id').primaryKey().$defaultFn(createUuidV7);
}

export function createdAtColumn() {
  return timestamp('created_at', timestampConfiguration).notNull().defaultNow();
}

export function updatedAtColumn() {
  return timestamp('updated_at', timestampConfiguration)
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date());
}

export function optimisticLockVersionColumn() {
  return integer('version').notNull().default(1);
}

export function deletedAtColumn() {
  return timestamp('deleted_at', timestampConfiguration);
}
