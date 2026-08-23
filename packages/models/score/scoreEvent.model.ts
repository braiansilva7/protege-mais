import {
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from '@core/models/user/user.model.js';
import {
  gameSessions,
  sessionQuestions,
} from '@core/models/game/gameSession.model.js';

export const scoreEvents = pgTable(
  'score_events',
  {
    id: uuid('id').primaryKey().notNull(),
    user_id: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    game_session_id: uuid('game_session_id')
      .references(() => gameSessions.id)
      .notNull(),
    session_question_id: uuid('session_question_id')
      .references(() => sessionQuestions.id)
      .notNull(),
    points: integer('points').notNull(),
    event_type: varchar('event_type', { length: 20 }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('score_events_user_created_at_idx').on(
      table.user_id,
      table.created_at
    ),
    index('score_events_game_session_id_idx').on(table.game_session_id),
    index('score_events_session_question_id_idx').on(table.session_question_id),
  ]
);
