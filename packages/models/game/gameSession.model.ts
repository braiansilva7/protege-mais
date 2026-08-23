import {
  boolean,
  index,
  integer,
  pgTable,
  smallint,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from '@core/models/user/user.model.js';
import { questions } from '@core/models/question/question.model.js';
import { answerOptions } from '@core/models/answer/answer.model.js';

export const gameSessions = pgTable(
  'game_sessions',
  {
    id: uuid('id').primaryKey().notNull(),
    user_id: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    language_code: varchar('language_code', { length: 5 }).notNull(),
    current_level: smallint('current_level').default(1).notNull(),
    score: integer('score').default(0).notNull(),
    skips_remaining: smallint('skips_remaining').default(3).notNull(),
    status: varchar('status', { length: 20 }).default('IN_PROGRESS').notNull(),
    started_at: timestamp('started_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    finished_at: timestamp('finished_at', {
      withTimezone: true,
      mode: 'string',
    }),
  },
  (table) => [
    index('game_sessions_user_status_started_at_idx').on(
      table.user_id,
      table.status,
      table.started_at
    ),
  ]
);

export const sessionQuestions = pgTable(
  'session_questions',
  {
    id: uuid('id').primaryKey().notNull(),
    game_session_id: uuid('game_session_id')
      .references(() => gameSessions.id, { onDelete: 'cascade' })
      .notNull(),
    question_id: uuid('question_id')
      .references(() => questions.id)
      .notNull(),
    difficulty_level: smallint('difficulty_level').notNull(),
    order_number: integer('order_number').notNull(),
    status: varchar('status', { length: 20 }).default('PENDING').notNull(),
    selected_answer_option_id: uuid('selected_answer_option_id').references(
      () => answerOptions.id
    ),
    is_correct: boolean('is_correct'),
    earned_points: integer('earned_points').default(0).notNull(),
    presented_at: timestamp('presented_at', {
      withTimezone: true,
      mode: 'string',
    }),
    answered_at: timestamp('answered_at', {
      withTimezone: true,
      mode: 'string',
    }),
    skipped_at: timestamp('skipped_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [index('session_questions_question_id_idx').on(table.question_id)]
);
