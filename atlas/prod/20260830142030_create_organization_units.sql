-- Create "organization_units" table
CREATE TABLE "public"."organization_units" (
  "id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "name" character varying(160) NOT NULL,
  "name_normalized" character varying(160) NOT NULL,
  "code" character varying(63) NOT NULL,
  "type" character varying(63) NOT NULL,
  "contact_email" character varying(320) NULL,
  "contact_phone_e164" character varying(16) NULL,
  "address_street" character varying(255) NOT NULL,
  "address_number" character varying(31) NOT NULL,
  "address_complement" character varying(160) NULL,
  "address_district" character varying(160) NOT NULL,
  "postal_code" character varying(8) NOT NULL,
  "state_code" character varying(2) NOT NULL,
  "municipality_code" character varying(7) NOT NULL,
  "longitude" double precision NOT NULL,
  "latitude" double precision NOT NULL,
  "position" public.geography(Point,4326) NOT NULL GENERATED ALWAYS AS ((public.st_setsrid(public.st_makepoint(longitude, latitude), 4326))::public.geography) STORED,
  "is_active" boolean NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  "version" integer NOT NULL DEFAULT 1,
  "deleted_at" timestamptz(3) NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "organization_units_organization_id_code_key" UNIQUE ("organization_id", "code"),
  CONSTRAINT "organization_units_organization_id_id_key" UNIQUE ("organization_id", "id"),
  CONSTRAINT "organization_units_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "organization_units_address_normalization_check" CHECK ((char_length((address_street)::text) > 0) AND ((address_street)::text = btrim((address_street)::text)) AND ((address_street)::text !~ '[[:cntrl:]]'::text) AND ((address_street)::text !~ '[[:space:]]{2,}'::text) AND (char_length((address_number)::text) > 0) AND ((address_number)::text = btrim((address_number)::text)) AND ((address_number)::text !~ '[[:cntrl:]]'::text) AND ((address_number)::text !~ '[[:space:]]{2,}'::text) AND ((address_complement IS NULL) OR ((char_length((address_complement)::text) > 0) AND ((address_complement)::text = btrim((address_complement)::text)) AND ((address_complement)::text !~ '[[:cntrl:]]'::text) AND ((address_complement)::text !~ '[[:space:]]{2,}'::text))) AND (char_length((address_district)::text) > 0) AND ((address_district)::text = btrim((address_district)::text)) AND ((address_district)::text !~ '[[:cntrl:]]'::text) AND ((address_district)::text !~ '[[:space:]]{2,}'::text)),
  CONSTRAINT "organization_units_code_check" CHECK (((code)::text = upper(btrim((code)::text))) AND ((code)::text ~ '^[A-Z0-9][A-Z0-9._-]{0,62}$'::text)),
  CONSTRAINT "organization_units_contact_email_check" CHECK ((contact_email IS NULL) OR (((contact_email)::text = lower(btrim((contact_email)::text))) AND ((contact_email)::text ~ '^[^@[:space:]]+@[^@[:space:]]+$'::text))),
  CONSTRAINT "organization_units_contact_phone_e164_check" CHECK ((contact_phone_e164 IS NULL) OR ((contact_phone_e164)::text ~ '^\+[1-9][0-9]{1,14}$'::text)),
  CONSTRAINT "organization_units_latitude_check" CHECK ((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision)),
  CONSTRAINT "organization_units_longitude_check" CHECK ((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision)),
  CONSTRAINT "organization_units_municipality_code_check" CHECK ((municipality_code)::text ~ '^[0-9]{7}$'::text),
  CONSTRAINT "organization_units_municipality_state_check" CHECK (((municipality_code)::text !~ '^[0-9]{7}$'::text) OR ("left"((municipality_code)::text, 2) =
CASE state_code
    WHEN 'AC'::text THEN '12'::text
    WHEN 'AL'::text THEN '27'::text
    WHEN 'AP'::text THEN '16'::text
    WHEN 'AM'::text THEN '13'::text
    WHEN 'BA'::text THEN '29'::text
    WHEN 'CE'::text THEN '23'::text
    WHEN 'DF'::text THEN '53'::text
    WHEN 'ES'::text THEN '32'::text
    WHEN 'GO'::text THEN '52'::text
    WHEN 'MA'::text THEN '21'::text
    WHEN 'MT'::text THEN '51'::text
    WHEN 'MS'::text THEN '50'::text
    WHEN 'MG'::text THEN '31'::text
    WHEN 'PA'::text THEN '15'::text
    WHEN 'PB'::text THEN '25'::text
    WHEN 'PR'::text THEN '41'::text
    WHEN 'PE'::text THEN '26'::text
    WHEN 'PI'::text THEN '22'::text
    WHEN 'RJ'::text THEN '33'::text
    WHEN 'RN'::text THEN '24'::text
    WHEN 'RS'::text THEN '43'::text
    WHEN 'RO'::text THEN '11'::text
    WHEN 'RR'::text THEN '14'::text
    WHEN 'SC'::text THEN '42'::text
    WHEN 'SP'::text THEN '35'::text
    WHEN 'SE'::text THEN '28'::text
    WHEN 'TO'::text THEN '17'::text
    ELSE NULL::text
END)),
  CONSTRAINT "organization_units_name_normalization_check" CHECK ((char_length((name)::text) > 0) AND ((name)::text = btrim((name)::text)) AND ((name)::text !~ '[[:cntrl:]]'::text) AND ((name)::text !~ '[[:space:]]{2,}'::text) AND ((name_normalized)::text = lower((name)::text))),
  CONSTRAINT "organization_units_postal_code_check" CHECK ((postal_code)::text ~ '^[0-9]{8}$'::text),
  CONSTRAINT "organization_units_state_code_check" CHECK ((state_code)::text = ANY ((ARRAY['AC'::character varying, 'AL'::character varying, 'AP'::character varying, 'AM'::character varying, 'BA'::character varying, 'CE'::character varying, 'DF'::character varying, 'ES'::character varying, 'GO'::character varying, 'MA'::character varying, 'MT'::character varying, 'MS'::character varying, 'MG'::character varying, 'PA'::character varying, 'PB'::character varying, 'PR'::character varying, 'PE'::character varying, 'PI'::character varying, 'RJ'::character varying, 'RN'::character varying, 'RS'::character varying, 'RO'::character varying, 'RR'::character varying, 'SC'::character varying, 'SP'::character varying, 'SE'::character varying, 'TO'::character varying])::text[])),
  CONSTRAINT "organization_units_type_check" CHECK (((type)::text = lower(btrim((type)::text))) AND ((type)::text ~ '^[a-z][a-z0-9_]{0,62}$'::text)),
  CONSTRAINT "organization_units_version_check" CHECK (version > 0)
);
-- Create index "organization_units_organization_name_active_idx" to table: "organization_units"
CREATE INDEX "organization_units_organization_name_active_idx" ON "public"."organization_units" ("organization_id", "name_normalized") WHERE ((deleted_at IS NULL) AND is_active);
-- Create index "organization_units_position_gix" to table: "organization_units"
CREATE INDEX "organization_units_position_gix" ON "public"."organization_units" USING GIST ("position");
-- Modify "account_roles" table
ALTER TABLE "public"."account_roles" ADD CONSTRAINT "account_roles_organization_id_organization_unit_id_fkey" FOREIGN KEY ("organization_id", "organization_unit_id") REFERENCES "public"."organization_units" ("organization_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "account_roles_organization_unit_id_idx" to table: "account_roles"
CREATE INDEX "account_roles_organization_unit_id_idx" ON "public"."account_roles" ("organization_unit_id");
