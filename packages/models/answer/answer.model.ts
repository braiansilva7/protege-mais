import {
  boolean,
  pgTable,
  smallint,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { questions } from '@core/models/question/question.model.js';

export const answerOptions = pgTable('answer_options', {
  id: uuid('id').primaryKey().notNull(),
  question_id: uuid('question_id')
    .references(() => questions.id, { onDelete: 'cascade' })
    .notNull(),
  position: smallint('position').notNull(),
  is_correct: boolean('is_correct').default(false).notNull(),
});

export const answerOptionTranslations = pgTable('answer_option_translations', {
  id: uuid('id').primaryKey().notNull(),
  answer_option_id: uuid('answer_option_id')
    .references(() => answerOptions.id, { onDelete: 'cascade' })
    .notNull(),
  language_code: varchar('language_code', { length: 5 }).notNull(),
  content: text('content').notNull(),
});
