-- Create "organization_members" table
CREATE TABLE "public"."organization_members" (
  "id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "organization_unit_id" uuid NULL,
  "registration_number" character varying(63) NULL,
  "job_title" character varying(160) NULL,
  "is_active" boolean NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  "version" integer NOT NULL DEFAULT 1,
  PRIMARY KEY ("id"),
  CONSTRAINT "organization_members_account_organization_unit_key" UNIQUE NULLS NOT DISTINCT ("account_id", "organization_id", "organization_unit_id"),
  CONSTRAINT "organization_members_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "organization_members_organization_unit_context_fkey" FOREIGN KEY ("organization_id", "organization_unit_id") REFERENCES "public"."organization_units" ("organization_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "organization_members_job_title_check" CHECK ((job_title IS NULL) OR ((char_length((job_title)::text) > 0) AND ((job_title)::text = btrim((job_title)::text)) AND ((job_title)::text !~ '[[:cntrl:]]'::text) AND ((job_title)::text !~ '[[:space:]]{2,}'::text))),
  CONSTRAINT "organization_members_registration_number_check" CHECK ((registration_number IS NULL) OR ((char_length((registration_number)::text) > 0) AND ((registration_number)::text = btrim((registration_number)::text)) AND ((registration_number)::text !~ '[[:cntrl:]]'::text) AND ((registration_number)::text !~ '[[:space:]]{2,}'::text))),
  CONSTRAINT "organization_members_version_check" CHECK (version > 0)
);
-- Create index "organization_members_account_context_active_idx" to table: "organization_members"
CREATE INDEX "organization_members_account_context_active_idx" ON "public"."organization_members" ("account_id", "organization_id", "organization_unit_id") WHERE is_active;
-- Create index "organization_members_organization_unit_idx" to table: "organization_members"
CREATE INDEX "organization_members_organization_unit_idx" ON "public"."organization_members" ("organization_id", "organization_unit_id");
