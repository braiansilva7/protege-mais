-- Create "auth_sessions" table
CREATE TABLE "public"."auth_sessions" (
  "id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "refresh_token_hash" character varying(255) NOT NULL,
  "device_identifier" character varying(128) NOT NULL,
  "device_name" character varying(120) NULL,
  "ip_hash" character varying(255) NULL,
  "user_agent" character varying(512) NULL,
  "expires_at" timestamptz(3) NOT NULL,
  "last_used_at" timestamptz(3) NULL,
  "revoked_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  "version" integer NOT NULL DEFAULT 1,
  PRIMARY KEY ("id"),
  CONSTRAINT "auth_sessions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "auth_sessions_device_identifier_check" CHECK ((device_identifier)::text ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'::text),
  CONSTRAINT "auth_sessions_device_name_check" CHECK ((device_name IS NULL) OR ((char_length((device_name)::text) > 0) AND ((device_name)::text = btrim((device_name)::text)) AND ((device_name)::text !~ '[[:cntrl:]]'::text))),
  CONSTRAINT "auth_sessions_ip_hash_check" CHECK ((ip_hash IS NULL) OR ((char_length((ip_hash)::text) > 0) AND ((ip_hash)::text !~ '[[:space:]]'::text))),
  CONSTRAINT "auth_sessions_lifecycle_check" CHECK ((expires_at > created_at) AND ((last_used_at IS NULL) OR ((last_used_at >= created_at) AND (last_used_at < expires_at))) AND ((revoked_at IS NULL) OR (revoked_at >= created_at)) AND ((revoked_at IS NULL) OR (last_used_at IS NULL) OR (last_used_at <= revoked_at))),
  CONSTRAINT "auth_sessions_refresh_token_hash_check" CHECK ((char_length((refresh_token_hash)::text) > 0) AND ((refresh_token_hash)::text !~ '[[:space:]]'::text)),
  CONSTRAINT "auth_sessions_user_agent_check" CHECK ((user_agent IS NULL) OR ((char_length((user_agent)::text) > 0) AND ((user_agent)::text = btrim((user_agent)::text)) AND ((user_agent)::text !~ '[[:cntrl:]]'::text))),
  CONSTRAINT "auth_sessions_version_check" CHECK (version > 0)
);
-- Create index "auth_sessions_account_id_revoked_at_expires_at_idx" to table: "auth_sessions"
CREATE INDEX "auth_sessions_account_id_revoked_at_expires_at_idx" ON "public"."auth_sessions" ("account_id", "revoked_at", "expires_at");
-- Create index "auth_sessions_refresh_token_hash_uidx" to table: "auth_sessions"
CREATE UNIQUE INDEX "auth_sessions_refresh_token_hash_uidx" ON "public"."auth_sessions" ("refresh_token_hash");
