import {
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { categories } from '@core/models/category/category.model.js';
import { users } from '@core/models/user/user.model.js';

export const questions = pgTable(
  'questions',
  {
    id: uuid('id').primaryKey().notNull(),
    difficulty_level: smallint('difficulty_level').notNull(),
    category_id: uuid('category_id')
      .references(() => categories.id)
      .notNull(),
    status: varchar('status', { length: 20 }).default('DRAFT').notNull(),
    created_by_user_id: uuid('created_by_user_id')
      .references(() => users.id)
      .notNull(),
    published_at: timestamp('published_at', {
      withTimezone: true,
      mode: 'string',
    }),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('questions_category_id_idx').on(table.category_id),
    index('questions_created_by_user_id_idx').on(table.created_by_user_id),
  ]
);

export const questionTranslations = pgTable('question_translations', {
  id: uuid('id').primaryKey().notNull(),
  question_id: uuid('question_id')
    .references(() => questions.id, { onDelete: 'cascade' })
    .notNull(),
  language_code: varchar('language_code', { length: 5 }).notNull(),
  statement: text('statement').notNull(),
  explanation: text('explanation').notNull(),
});
