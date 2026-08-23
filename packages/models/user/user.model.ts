import {
  boolean,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
  index,
} from 'drizzle-orm/pg-core';
import { countries } from '@core/models/country/country.model.js';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().notNull(),
    username: varchar('username', { length: 120 }).notNull().unique(),
    email: varchar('email', { length: 320 }).notNull().unique(),
    password_hash: varchar('password_hash', { length: 512 }).notNull(),
    country_id: uuid('country_id').references(() => countries.id),
    language_code: varchar('language_code', { length: 5 }).notNull(),
    profile_picture_url: varchar('profile_picture_url', { length: 2048 }),
    total_score: integer('total_score').default(0).notNull(),
    active: boolean('active').default(true).notNull(),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('users_country_id_idx').on(table.country_id)]
);
