import {
  boolean,
  index,
  pgTable,
  smallint,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  gameSessions,
  sessionQuestions,
} from '@core/models/game/gameSession.model.js';
import { answerOptions } from '@core/models/answer/answer.model.js';

export const jokerTypes = pgTable('joker_types', {
  id: smallint('id').primaryKey().notNull(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  eliminated_wrong_answers: smallint('eliminated_wrong_answers')
    .default(0)
    .notNull(),
  reveals_correct_answer: boolean('reveals_correct_answer')
    .default(false)
    .notNull(),
  active: boolean('active').default(true).notNull(),
});

export const sessionJokers = pgTable(
  'session_jokers',
  {
    id: uuid('id').primaryKey().notNull(),
    game_session_id: uuid('game_session_id')
      .references(() => gameSessions.id, { onDelete: 'cascade' })
      .notNull(),
    joker_type_id: smallint('joker_type_id')
      .references(() => jokerTypes.id)
      .notNull(),
    quantity_available: smallint('quantity_available').default(0).notNull(),
    quantity_used: smallint('quantity_used').default(0).notNull(),
  },
  (table) => [index('session_jokers_joker_type_id_idx').on(table.joker_type_id)]
);

export const jokerUsages = pgTable(
  'joker_usages',
  {
    id: uuid('id').primaryKey().notNull(),
    session_question_id: uuid('session_question_id')
      .references(() => sessionQuestions.id, { onDelete: 'cascade' })
      .notNull(),
    joker_type_id: smallint('joker_type_id')
      .references(() => jokerTypes.id)
      .notNull(),
    used_at: timestamp('used_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('joker_usages_joker_type_id_idx').on(table.joker_type_id)]
);

export const jokerEliminatedOptions = pgTable(
  'joker_eliminated_options',
  {
    id: uuid('id').primaryKey().notNull(),
    joker_usage_id: uuid('joker_usage_id')
      .references(() => jokerUsages.id, { onDelete: 'cascade' })
      .notNull(),
    answer_option_id: uuid('answer_option_id')
      .references(() => answerOptions.id)
      .notNull(),
  },
  (table) => [
    index('joker_eliminated_options_answer_option_id_idx').on(
      table.answer_option_id
    ),
  ]
);
