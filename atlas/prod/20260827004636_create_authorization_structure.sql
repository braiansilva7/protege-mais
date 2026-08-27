-- Create "roles" table
CREATE TABLE "public"."roles" (
  "id" uuid NOT NULL,
  "code" character varying(63) NOT NULL,
  "is_system" boolean NOT NULL,
  "is_active" boolean NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  "version" integer NOT NULL DEFAULT 1,
  PRIMARY KEY ("id"),
  CONSTRAINT "roles_code_key" UNIQUE ("code"),
  CONSTRAINT "roles_code_check" CHECK ((code)::text ~ '^[a-z][a-z0-9_]{0,62}$'::text),
  CONSTRAINT "roles_system_state_check" CHECK ((NOT is_system) OR is_active),
  CONSTRAINT "roles_version_check" CHECK (version > 0)
);
-- Create "account_roles" table
CREATE TABLE "public"."account_roles" (
  "id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "role_id" uuid NOT NULL,
  "organization_id" uuid NULL,
  "organization_unit_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "account_roles_account_role_context_key" UNIQUE NULLS NOT DISTINCT ("account_id", "role_id", "organization_id", "organization_unit_id"),
  CONSTRAINT "account_roles_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "account_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "account_roles_scope_check" CHECK ((organization_unit_id IS NULL) OR (organization_id IS NOT NULL))
);
-- Create index "account_roles_context_lookup_idx" to table: "account_roles"
CREATE INDEX "account_roles_context_lookup_idx" ON "public"."account_roles" ("account_id", "organization_id", "organization_unit_id", "role_id");
-- Create index "account_roles_role_id_idx" to table: "account_roles"
CREATE INDEX "account_roles_role_id_idx" ON "public"."account_roles" ("role_id");
-- Create "permissions" table
CREATE TABLE "public"."permissions" (
  "id" uuid NOT NULL,
  "code" character varying(127) NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "permissions_code_key" UNIQUE ("code"),
  CONSTRAINT "permissions_code_check" CHECK ((code)::text ~ '^[a-z][a-z0-9_]{0,62}\.[a-z][a-z0-9_]{0,62}$'::text)
);
-- Create "role_permissions" table
CREATE TABLE "public"."role_permissions" (
  "role_id" uuid NOT NULL,
  "permission_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("role_id", "permission_id"),
  CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "role_permissions_permission_id_idx" to table: "role_permissions"
CREATE INDEX "role_permissions_permission_id_idx" ON "public"."role_permissions" ("permission_id");
