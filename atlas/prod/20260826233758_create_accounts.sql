-- Create "accounts" table
CREATE TABLE "public"."accounts" (
  "id" uuid NOT NULL,
  "email" character varying(320) NULL,
  "email_normalized" character varying(320) NULL,
  "phone_e164" character varying(16) NULL,
  "password_hash" text NULL,
  "external_provider" character varying(63) NULL,
  "external_subject" character varying(255) NULL,
  "type" "public"."account_type" NOT NULL,
  "status" "public"."account_status" NOT NULL,
  "mfa_enabled" boolean NOT NULL,
  "last_login_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  "version" integer NOT NULL DEFAULT 1,
  "deleted_at" timestamptz(3) NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "accounts_email_normalization_check" CHECK (((email IS NULL) AND (email_normalized IS NULL)) OR ((email IS NOT NULL) AND (email_normalized IS NOT NULL) AND ((email)::text = btrim((email)::text)) AND ((email_normalized)::text = lower((email)::text)) AND ((email_normalized)::text ~ '^[^@[:space:]]+@[^@[:space:]]+$'::text))),
  CONSTRAINT "accounts_external_identity_check" CHECK (((external_provider IS NULL) AND (external_subject IS NULL)) OR ((external_provider IS NOT NULL) AND (external_subject IS NOT NULL) AND ((external_provider)::text = lower(btrim((external_provider)::text))) AND ((external_provider)::text ~ '^[a-z][a-z0-9_-]{0,62}$'::text) AND (char_length((external_subject)::text) > 0))),
  CONSTRAINT "accounts_identity_method_check" CHECK (((email_normalized IS NOT NULL) AND (password_hash IS NOT NULL)) OR ((external_provider IS NOT NULL) AND (external_subject IS NOT NULL))),
  CONSTRAINT "accounts_password_hash_check" CHECK ((password_hash IS NULL) OR (char_length(password_hash) > 0)),
  CONSTRAINT "accounts_phone_e164_check" CHECK ((phone_e164 IS NULL) OR ((phone_e164)::text ~ '^\+[1-9][0-9]{1,14}$'::text)),
  CONSTRAINT "accounts_version_check" CHECK (version > 0)
);
-- Create index "accounts_email_normalized_active_uidx" to table: "accounts"
CREATE UNIQUE INDEX "accounts_email_normalized_active_uidx" ON "public"."accounts" ("email_normalized") WHERE ((deleted_at IS NULL) AND (email_normalized IS NOT NULL));
-- Create index "accounts_external_provider_external_subject_active_uidx" to table: "accounts"
CREATE UNIQUE INDEX "accounts_external_provider_external_subject_active_uidx" ON "public"."accounts" ("external_provider", "external_subject") WHERE ((deleted_at IS NULL) AND (external_provider IS NOT NULL) AND (external_subject IS NOT NULL));
-- Create index "accounts_phone_e164_active_uidx" to table: "accounts"
CREATE UNIQUE INDEX "accounts_phone_e164_active_uidx" ON "public"."accounts" ("phone_e164") WHERE ((deleted_at IS NULL) AND (phone_e164 IS NOT NULL));
