-- Create "convention_owners" table
CREATE TABLE "public"."convention_owners" (
  "id" uuid NOT NULL,
  "code" character varying(64) NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  "version" integer NOT NULL DEFAULT 1,
  PRIMARY KEY ("id"),
  CONSTRAINT "convention_owners_code_key" UNIQUE ("code"),
  CONSTRAINT "convention_owners_version_check" CHECK (version > 0)
);
-- Create "convention_records" table
CREATE TABLE "public"."convention_records" (
  "id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "external_key" character varying(120) NOT NULL,
  "optional_label" character varying(160) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  "version" integer NOT NULL DEFAULT 1,
  "deleted_at" timestamptz(3) NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "convention_records_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."convention_owners" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "convention_records_version_check" CHECK (version > 0)
);
-- Create index "convention_records_owner_id_external_key_active_uidx" to table: "convention_records"
CREATE UNIQUE INDEX "convention_records_owner_id_external_key_active_uidx" ON "public"."convention_records" ("owner_id", "external_key") WHERE (deleted_at IS NULL);
-- Create index "convention_records_owner_id_idx" to table: "convention_records"
CREATE INDEX "convention_records_owner_id_idx" ON "public"."convention_records" ("owner_id");
