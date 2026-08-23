-- Create extension "pgcrypto"
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create "countries" table
CREATE TABLE "countries" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "iso_code" character varying(2) NOT NULL,
  "name" character varying(120) NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  PRIMARY KEY ("id"),
  CONSTRAINT "countries_iso_code_unique" UNIQUE ("iso_code"),
  CONSTRAINT "countries_iso_code_format" CHECK (iso_code ~ '^[A-Z]{2}$'),
  CONSTRAINT "countries_name_not_blank" CHECK (btrim(name) <> '')
);

-- Create "users" table
CREATE TABLE "users" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "username" character varying(120) NOT NULL,
  "email" character varying(320) NOT NULL,
  "password_hash" character varying(512) NOT NULL,
  "role" character varying(20) NOT NULL,
  "country_id" uuid NULL,
  "language_code" character varying(5) NOT NULL,
  "profile_picture_url" character varying(2048) NULL,
  "total_score" integer NOT NULL DEFAULT 0,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "users_username_unique" UNIQUE ("username"),
  CONSTRAINT "users_email_unique" UNIQUE ("email"),
  CONSTRAINT "users_role_valid" CHECK (role IN ('ADMIN', 'PLAYER')),
  CONSTRAINT "users_language_code_valid" CHECK (language_code IN ('pt-BR', 'en', 'es')),
  CONSTRAINT "users_total_score_non_negative" CHECK (total_score >= 0),
  CONSTRAINT "users_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries" ("id") ON DELETE RESTRICT
);
CREATE INDEX "users_country_id_idx" ON "users" ("country_id");
CREATE UNIQUE INDEX "users_email_normalized_key" ON "users" (lower(email));

-- Create "categories" table
CREATE TABLE "categories" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" character varying(120) NOT NULL,
  "description" character varying(1000) NULL,
  "active" boolean NOT NULL DEFAULT true,
  PRIMARY KEY ("id"),
  CONSTRAINT "categories_name_unique" UNIQUE ("name"),
  CONSTRAINT "categories_name_not_blank" CHECK (btrim(name) <> '')
);

-- Create "questions" table
CREATE TABLE "questions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "difficulty_level" smallint NOT NULL,
  "category_id" uuid NOT NULL,
  "status" character varying(20) NOT NULL DEFAULT 'DRAFT',
  "created_by_user_id" uuid NOT NULL,
  "published_at" timestamptz NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "questions_difficulty_level_valid" CHECK (difficulty_level BETWEEN 1 AND 3),
  CONSTRAINT "questions_status_valid" CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  CONSTRAINT "questions_published_at_valid" CHECK (
    (status = 'PUBLISHED' AND published_at IS NOT NULL)
    OR (status IN ('DRAFT', 'ARCHIVED'))
  ),
  CONSTRAINT "questions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE RESTRICT,
  CONSTRAINT "questions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT
);
CREATE INDEX "questions_category_id_idx" ON "questions" ("category_id");
CREATE INDEX "questions_created_by_user_id_idx" ON "questions" ("created_by_user_id");
CREATE INDEX "questions_published_selection_idx" ON "questions" ("category_id", "difficulty_level", "published_at") WHERE status = 'PUBLISHED';

-- Create "question_translations" table
CREATE TABLE "question_translations" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "question_id" uuid NOT NULL,
  "language_code" character varying(5) NOT NULL,
  "statement" text NOT NULL,
  "explanation" text NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "question_translations_language_code_valid" CHECK (language_code IN ('pt-BR', 'en', 'es')),
  CONSTRAINT "question_translations_statement_not_blank" CHECK (btrim(statement) <> ''),
  CONSTRAINT "question_translations_explanation_not_blank" CHECK (btrim(explanation) <> ''),
  CONSTRAINT "question_translations_question_language_key" UNIQUE ("question_id", "language_code"),
  CONSTRAINT "question_translations_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON DELETE CASCADE
);
CREATE INDEX "question_translations_language_code_idx" ON "question_translations" ("language_code");

-- Create "answer_options" table
CREATE TABLE "answer_options" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "question_id" uuid NOT NULL,
  "position" smallint NOT NULL,
  "is_correct" boolean NOT NULL DEFAULT false,
  PRIMARY KEY ("id"),
  CONSTRAINT "answer_options_position_valid" CHECK (position BETWEEN 1 AND 5),
  CONSTRAINT "answer_options_question_position_key" UNIQUE ("question_id", "position"),
  CONSTRAINT "answer_options_id_question_id_key" UNIQUE ("id", "question_id"),
  CONSTRAINT "answer_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "answer_options_one_correct_per_question_key" ON "answer_options" ("question_id") WHERE is_correct;

-- Create "answer_option_translations" table
CREATE TABLE "answer_option_translations" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "answer_option_id" uuid NOT NULL,
  "language_code" character varying(5) NOT NULL,
  "content" text NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "answer_option_translations_language_code_valid" CHECK (language_code IN ('pt-BR', 'en', 'es')),
  CONSTRAINT "answer_option_translations_content_not_blank" CHECK (btrim(content) <> ''),
  CONSTRAINT "answer_option_translations_option_language_key" UNIQUE ("answer_option_id", "language_code"),
  CONSTRAINT "answer_option_translations_answer_option_id_fkey" FOREIGN KEY ("answer_option_id") REFERENCES "answer_options" ("id") ON DELETE CASCADE
);
CREATE INDEX "answer_option_translations_language_code_idx" ON "answer_option_translations" ("language_code");

-- Create "player_progress" table
CREATE TABLE "player_progress" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "highest_unlocked_level" smallint NOT NULL DEFAULT 1,
  "total_correct_answers" integer NOT NULL DEFAULT 0,
  "total_questions_answered" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "player_progress_user_id_unique" UNIQUE ("user_id"),
  CONSTRAINT "player_progress_highest_unlocked_level_valid" CHECK (highest_unlocked_level BETWEEN 1 AND 3),
  CONSTRAINT "player_progress_total_correct_answers_valid" CHECK (total_correct_answers >= 0),
  CONSTRAINT "player_progress_total_questions_answered_valid" CHECK (total_questions_answered >= 0),
  CONSTRAINT "player_progress_correct_answers_valid" CHECK (total_correct_answers <= total_questions_answered),
  CONSTRAINT "player_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- Create "game_sessions" table
CREATE TABLE "game_sessions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "language_code" character varying(5) NOT NULL,
  "current_level" smallint NOT NULL DEFAULT 1,
  "score" integer NOT NULL DEFAULT 0,
  "skips_remaining" smallint NOT NULL DEFAULT 3,
  "status" character varying(20) NOT NULL DEFAULT 'IN_PROGRESS',
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "finished_at" timestamptz NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "game_sessions_language_code_valid" CHECK (language_code IN ('pt-BR', 'en', 'es')),
  CONSTRAINT "game_sessions_current_level_valid" CHECK (current_level BETWEEN 1 AND 3),
  CONSTRAINT "game_sessions_skips_remaining_valid" CHECK (skips_remaining BETWEEN 0 AND 3),
  CONSTRAINT "game_sessions_status_valid" CHECK (status IN ('IN_PROGRESS', 'FINISHED', 'ABANDONED')),
  CONSTRAINT "game_sessions_finished_at_valid" CHECK (
    (status = 'IN_PROGRESS' AND finished_at IS NULL)
    OR (status IN ('FINISHED', 'ABANDONED') AND finished_at IS NOT NULL)
  ),
  CONSTRAINT "game_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT
);
CREATE INDEX "game_sessions_user_status_started_at_idx" ON "game_sessions" ("user_id", "status", "started_at" DESC);
CREATE UNIQUE INDEX "game_sessions_one_active_per_user_key" ON "game_sessions" ("user_id") WHERE status = 'IN_PROGRESS';

-- Create "session_questions" table
CREATE TABLE "session_questions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "game_session_id" uuid NOT NULL,
  "question_id" uuid NOT NULL,
  "difficulty_level" smallint NOT NULL,
  "order_number" integer NOT NULL,
  "status" character varying(20) NOT NULL DEFAULT 'PENDING',
  "selected_answer_option_id" uuid NULL,
  "is_correct" boolean NULL,
  "earned_points" integer NOT NULL DEFAULT 0,
  "presented_at" timestamptz NULL,
  "answered_at" timestamptz NULL,
  "skipped_at" timestamptz NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "session_questions_difficulty_level_valid" CHECK (difficulty_level BETWEEN 1 AND 3),
  CONSTRAINT "session_questions_order_number_valid" CHECK (order_number > 0),
  CONSTRAINT "session_questions_status_valid" CHECK (status IN ('PENDING', 'ANSWERED', 'SKIPPED')),
  CONSTRAINT "session_questions_game_session_order_key" UNIQUE ("game_session_id", "order_number"),
  CONSTRAINT "session_questions_game_session_question_key" UNIQUE ("game_session_id", "question_id"),
  CONSTRAINT "session_questions_resolution_valid" CHECK (
    (status = 'PENDING' AND selected_answer_option_id IS NULL AND is_correct IS NULL
      AND answered_at IS NULL AND skipped_at IS NULL)
    OR (status = 'ANSWERED' AND selected_answer_option_id IS NOT NULL AND is_correct IS NOT NULL
      AND answered_at IS NOT NULL AND skipped_at IS NULL)
    OR (status = 'SKIPPED' AND selected_answer_option_id IS NULL AND is_correct IS NULL
      AND answered_at IS NULL AND skipped_at IS NOT NULL)
  ),
  CONSTRAINT "session_questions_game_session_id_fkey" FOREIGN KEY ("game_session_id") REFERENCES "game_sessions" ("id") ON DELETE CASCADE,
  CONSTRAINT "session_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON DELETE RESTRICT,
  CONSTRAINT "session_questions_selected_answer_option_id_fkey" FOREIGN KEY ("selected_answer_option_id") REFERENCES "answer_options" ("id") ON DELETE RESTRICT
);
CREATE INDEX "session_questions_question_id_idx" ON "session_questions" ("question_id");
CREATE INDEX "session_questions_pending_idx" ON "session_questions" ("game_session_id", "order_number") WHERE status = 'PENDING';

-- Create "joker_types" table
CREATE TABLE "joker_types" (
  "id" smallint NOT NULL,
  "code" character varying(20) NOT NULL,
  "eliminated_wrong_answers" smallint NOT NULL DEFAULT 0,
  "reveals_correct_answer" boolean NOT NULL DEFAULT false,
  "active" boolean NOT NULL DEFAULT true,
  PRIMARY KEY ("id"),
  CONSTRAINT "joker_types_code_unique" UNIQUE ("code"),
  CONSTRAINT "joker_types_id_valid" CHECK (id BETWEEN 1 AND 5),
  CONSTRAINT "joker_types_code_valid" CHECK (code IN ('ELIMINATE_1', 'ELIMINATE_2', 'ELIMINATE_3', 'ELIMINATE_4', 'REVEAL')),
  CONSTRAINT "joker_types_configuration_valid" CHECK (
    (code = 'ELIMINATE_1' AND eliminated_wrong_answers = 1 AND NOT reveals_correct_answer)
    OR (code = 'ELIMINATE_2' AND eliminated_wrong_answers = 2 AND NOT reveals_correct_answer)
    OR (code = 'ELIMINATE_3' AND eliminated_wrong_answers = 3 AND NOT reveals_correct_answer)
    OR (code = 'ELIMINATE_4' AND eliminated_wrong_answers = 4 AND NOT reveals_correct_answer)
    OR (code = 'REVEAL' AND eliminated_wrong_answers = 0 AND reveals_correct_answer)
  )
);

-- Create "session_jokers" table
CREATE TABLE "session_jokers" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "game_session_id" uuid NOT NULL,
  "joker_type_id" smallint NOT NULL,
  "quantity_available" smallint NOT NULL DEFAULT 0,
  "quantity_used" smallint NOT NULL DEFAULT 0,
  PRIMARY KEY ("id"),
  CONSTRAINT "session_jokers_game_session_type_key" UNIQUE ("game_session_id", "joker_type_id"),
  CONSTRAINT "session_jokers_quantity_available_valid" CHECK (quantity_available >= 0),
  CONSTRAINT "session_jokers_quantity_used_valid" CHECK (quantity_used BETWEEN 0 AND quantity_available),
  CONSTRAINT "session_jokers_game_session_id_fkey" FOREIGN KEY ("game_session_id") REFERENCES "game_sessions" ("id") ON DELETE CASCADE,
  CONSTRAINT "session_jokers_joker_type_id_fkey" FOREIGN KEY ("joker_type_id") REFERENCES "joker_types" ("id") ON DELETE RESTRICT
);
CREATE INDEX "session_jokers_joker_type_id_idx" ON "session_jokers" ("joker_type_id");

-- Create "joker_usages" table
CREATE TABLE "joker_usages" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "session_question_id" uuid NOT NULL,
  "joker_type_id" smallint NOT NULL,
  "used_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "joker_usages_question_type_key" UNIQUE ("session_question_id", "joker_type_id"),
  CONSTRAINT "joker_usages_session_question_id_fkey" FOREIGN KEY ("session_question_id") REFERENCES "session_questions" ("id") ON DELETE CASCADE,
  CONSTRAINT "joker_usages_joker_type_id_fkey" FOREIGN KEY ("joker_type_id") REFERENCES "joker_types" ("id") ON DELETE RESTRICT
);
CREATE INDEX "joker_usages_joker_type_id_idx" ON "joker_usages" ("joker_type_id");

-- Create "joker_eliminated_options" table
CREATE TABLE "joker_eliminated_options" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "joker_usage_id" uuid NOT NULL,
  "answer_option_id" uuid NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "joker_eliminated_options_usage_option_key" UNIQUE ("joker_usage_id", "answer_option_id"),
  CONSTRAINT "joker_eliminated_options_joker_usage_id_fkey" FOREIGN KEY ("joker_usage_id") REFERENCES "joker_usages" ("id") ON DELETE CASCADE,
  CONSTRAINT "joker_eliminated_options_answer_option_id_fkey" FOREIGN KEY ("answer_option_id") REFERENCES "answer_options" ("id") ON DELETE RESTRICT
);
CREATE INDEX "joker_eliminated_options_answer_option_id_idx" ON "joker_eliminated_options" ("answer_option_id");

-- Create "score_events" table
CREATE TABLE "score_events" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "game_session_id" uuid NOT NULL,
  "session_question_id" uuid NOT NULL,
  "points" integer NOT NULL,
  "event_type" character varying(20) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "score_events_event_type_valid" CHECK (event_type IN ('CORRECT_ANSWER', 'BONUS', 'PENALTY')),
  CONSTRAINT "score_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT,
  CONSTRAINT "score_events_game_session_id_fkey" FOREIGN KEY ("game_session_id") REFERENCES "game_sessions" ("id") ON DELETE RESTRICT,
  CONSTRAINT "score_events_session_question_id_fkey" FOREIGN KEY ("session_question_id") REFERENCES "session_questions" ("id") ON DELETE RESTRICT
);
CREATE INDEX "score_events_user_created_at_idx" ON "score_events" ("user_id", "created_at" DESC);
CREATE INDEX "score_events_game_session_id_idx" ON "score_events" ("game_session_id");
CREATE INDEX "score_events_session_question_id_idx" ON "score_events" ("session_question_id");

CREATE OR REPLACE FUNCTION validate_selected_answer_option()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.selected_answer_option_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM answer_options
     WHERE id = NEW.selected_answer_option_id
       AND question_id = NEW.question_id
  ) THEN
    RAISE EXCEPTION 'A opção selecionada deve pertencer à questão da sessão.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION validate_joker_eliminated_option()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM joker_usages
      JOIN session_questions ON session_questions.id = joker_usages.session_question_id
      JOIN answer_options ON answer_options.id = NEW.answer_option_id
     WHERE joker_usages.id = NEW.joker_usage_id
       AND answer_options.question_id = session_questions.question_id
       AND NOT answer_options.is_correct
  ) THEN
    RAISE EXCEPTION 'O curinga só pode eliminar uma opção incorreta da questão apresentada.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION validate_score_event_context()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM game_sessions
      JOIN session_questions ON session_questions.game_session_id = game_sessions.id
     WHERE game_sessions.id = NEW.game_session_id
       AND game_sessions.user_id = NEW.user_id
       AND session_questions.id = NEW.session_question_id
  ) THEN
    RAISE EXCEPTION 'O evento de pontuação deve referenciar usuário, partida e questão da mesma sessão.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER session_questions_validate_selected_option
BEFORE INSERT OR UPDATE OF question_id, selected_answer_option_id ON session_questions
FOR EACH ROW EXECUTE FUNCTION validate_selected_answer_option();

CREATE TRIGGER joker_eliminated_options_validate_option
BEFORE INSERT OR UPDATE OF joker_usage_id, answer_option_id ON joker_eliminated_options
FOR EACH ROW EXECUTE FUNCTION validate_joker_eliminated_option();

CREATE TRIGGER score_events_validate_context
BEFORE INSERT OR UPDATE OF user_id, game_session_id, session_question_id ON score_events
FOR EACH ROW EXECUTE FUNCTION validate_score_event_context();

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER questions_set_updated_at
BEFORE UPDATE ON questions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER player_progress_set_updated_at
BEFORE UPDATE ON player_progress
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
