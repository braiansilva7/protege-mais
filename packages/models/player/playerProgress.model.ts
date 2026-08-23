import {
  integer,
  pgTable,
  smallint,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from '@core/models/user/user.model.js';

export const playerProgress = pgTable('player_progress', {
  id: uuid('id').primaryKey().notNull(),
  user_id: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  highest_unlocked_level: smallint('highest_unlocked_level')
    .default(1)
    .notNull(),
  total_correct_answers: integer('total_correct_answers').default(0).notNull(),
  total_questions_answered: integer('total_questions_answered')
    .default(0)
    .notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .defaultNow()
    .notNull(),
});
