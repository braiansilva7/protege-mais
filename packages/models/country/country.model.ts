import { boolean, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

export const countries = pgTable('countries', {
  id: uuid('id').primaryKey().notNull(),
  iso_code: varchar('iso_code', { length: 2 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull(),
  active: boolean('active').default(true).notNull(),
});
