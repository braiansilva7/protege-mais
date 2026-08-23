import { boolean, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().notNull(),
  name: varchar('name', { length: 120 }).notNull().unique(),
  description: varchar('description', { length: 1000 }),
  active: boolean('active').default(true).notNull(),
});
