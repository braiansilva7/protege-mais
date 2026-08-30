-- Create "organizations" table
CREATE TABLE "public"."organizations" (
  "id" uuid NOT NULL,
  "name" character varying(160) NOT NULL,
  "name_normalized" character varying(160) NOT NULL,
  "legal_name" character varying(255) NOT NULL,
  "legal_name_normalized" character varying(255) NOT NULL,
  "type" "public"."organization_type" NOT NULL,
  "cnpj" character varying(14) NOT NULL,
  "state_code" character varying(2) NOT NULL,
  "municipality_code" character varying(7) NOT NULL,
  "is_active" boolean NOT NULL,
  "integration_enabled" boolean NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  "version" integer NOT NULL DEFAULT 1,
  "deleted_at" timestamptz(3) NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "organizations_cnpj_key" UNIQUE ("cnpj"),
  CONSTRAINT "organizations_cnpj_check_digits_check" CHECK (((cnpj)::text !~ '^[0-9A-Z]{12}[0-9]{2}$'::text) OR (((ascii(substr((cnpj)::text, 13, 1)) - 48) =
CASE
    WHEN (mod((((((((((((((ascii(substr((cnpj)::text, 1, 1)) - 48) * 5) + ((ascii(substr((cnpj)::text, 2, 1)) - 48) * 4)) + ((ascii(substr((cnpj)::text, 3, 1)) - 48) * 3)) + ((ascii(substr((cnpj)::text, 4, 1)) - 48) * 2)) + ((ascii(substr((cnpj)::text, 5, 1)) - 48) * 9)) + ((ascii(substr((cnpj)::text, 6, 1)) - 48) * 8)) + ((ascii(substr((cnpj)::text, 7, 1)) - 48) * 7)) + ((ascii(substr((cnpj)::text, 8, 1)) - 48) * 6)) + ((ascii(substr((cnpj)::text, 9, 1)) - 48) * 5)) + ((ascii(substr((cnpj)::text, 10, 1)) - 48) * 4)) + ((ascii(substr((cnpj)::text, 11, 1)) - 48) * 3)) + ((ascii(substr((cnpj)::text, 12, 1)) - 48) * 2)), 11) < 2) THEN 0
    ELSE (11 - mod((((((((((((((ascii(substr((cnpj)::text, 1, 1)) - 48) * 5) + ((ascii(substr((cnpj)::text, 2, 1)) - 48) * 4)) + ((ascii(substr((cnpj)::text, 3, 1)) - 48) * 3)) + ((ascii(substr((cnpj)::text, 4, 1)) - 48) * 2)) + ((ascii(substr((cnpj)::text, 5, 1)) - 48) * 9)) + ((ascii(substr((cnpj)::text, 6, 1)) - 48) * 8)) + ((ascii(substr((cnpj)::text, 7, 1)) - 48) * 7)) + ((ascii(substr((cnpj)::text, 8, 1)) - 48) * 6)) + ((ascii(substr((cnpj)::text, 9, 1)) - 48) * 5)) + ((ascii(substr((cnpj)::text, 10, 1)) - 48) * 4)) + ((ascii(substr((cnpj)::text, 11, 1)) - 48) * 3)) + ((ascii(substr((cnpj)::text, 12, 1)) - 48) * 2)), 11))
END) AND ((ascii(substr((cnpj)::text, 14, 1)) - 48) =
CASE
    WHEN (mod(((((((((((((((ascii(substr((cnpj)::text, 1, 1)) - 48) * 6) + ((ascii(substr((cnpj)::text, 2, 1)) - 48) * 5)) + ((ascii(substr((cnpj)::text, 3, 1)) - 48) * 4)) + ((ascii(substr((cnpj)::text, 4, 1)) - 48) * 3)) + ((ascii(substr((cnpj)::text, 5, 1)) - 48) * 2)) + ((ascii(substr((cnpj)::text, 6, 1)) - 48) * 9)) + ((ascii(substr((cnpj)::text, 7, 1)) - 48) * 8)) + ((ascii(substr((cnpj)::text, 8, 1)) - 48) * 7)) + ((ascii(substr((cnpj)::text, 9, 1)) - 48) * 6)) + ((ascii(substr((cnpj)::text, 10, 1)) - 48) * 5)) + ((ascii(substr((cnpj)::text, 11, 1)) - 48) * 4)) + ((ascii(substr((cnpj)::text, 12, 1)) - 48) * 3)) + ((ascii(substr((cnpj)::text, 13, 1)) - 48) * 2)), 11) < 2) THEN 0
    ELSE (11 - mod(((((((((((((((ascii(substr((cnpj)::text, 1, 1)) - 48) * 6) + ((ascii(substr((cnpj)::text, 2, 1)) - 48) * 5)) + ((ascii(substr((cnpj)::text, 3, 1)) - 48) * 4)) + ((ascii(substr((cnpj)::text, 4, 1)) - 48) * 3)) + ((ascii(substr((cnpj)::text, 5, 1)) - 48) * 2)) + ((ascii(substr((cnpj)::text, 6, 1)) - 48) * 9)) + ((ascii(substr((cnpj)::text, 7, 1)) - 48) * 8)) + ((ascii(substr((cnpj)::text, 8, 1)) - 48) * 7)) + ((ascii(substr((cnpj)::text, 9, 1)) - 48) * 6)) + ((ascii(substr((cnpj)::text, 10, 1)) - 48) * 5)) + ((ascii(substr((cnpj)::text, 11, 1)) - 48) * 4)) + ((ascii(substr((cnpj)::text, 12, 1)) - 48) * 3)) + ((ascii(substr((cnpj)::text, 13, 1)) - 48) * 2)), 11))
END))),
  CONSTRAINT "organizations_cnpj_format_check" CHECK (((cnpj)::text ~ '^[0-9A-Z]{12}[0-9]{2}$'::text) AND ((cnpj)::text <> '00000000000000'::text)),
  CONSTRAINT "organizations_legal_name_normalization_check" CHECK ((char_length((legal_name)::text) > 0) AND ((legal_name)::text = btrim((legal_name)::text)) AND ((legal_name)::text !~ '[[:cntrl:]]'::text) AND ((legal_name)::text !~ '[[:space:]]{2,}'::text) AND ((legal_name_normalized)::text = lower((legal_name)::text))),
  CONSTRAINT "organizations_municipality_code_check" CHECK ((municipality_code)::text ~ '^[0-9]{7}$'::text),
  CONSTRAINT "organizations_municipality_state_check" CHECK (((municipality_code)::text !~ '^[0-9]{7}$'::text) OR ("left"((municipality_code)::text, 2) =
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
  CONSTRAINT "organizations_name_normalization_check" CHECK ((char_length((name)::text) > 0) AND ((name)::text = btrim((name)::text)) AND ((name)::text !~ '[[:cntrl:]]'::text) AND ((name)::text !~ '[[:space:]]{2,}'::text) AND ((name_normalized)::text = lower((name)::text))),
  CONSTRAINT "organizations_state_code_check" CHECK ((state_code)::text = ANY ((ARRAY['AC'::character varying, 'AL'::character varying, 'AP'::character varying, 'AM'::character varying, 'BA'::character varying, 'CE'::character varying, 'DF'::character varying, 'ES'::character varying, 'GO'::character varying, 'MA'::character varying, 'MT'::character varying, 'MS'::character varying, 'MG'::character varying, 'PA'::character varying, 'PB'::character varying, 'PR'::character varying, 'PE'::character varying, 'PI'::character varying, 'RJ'::character varying, 'RN'::character varying, 'RS'::character varying, 'RO'::character varying, 'RR'::character varying, 'SC'::character varying, 'SP'::character varying, 'SE'::character varying, 'TO'::character varying])::text[])),
  CONSTRAINT "organizations_version_check" CHECK (version > 0)
);
-- Create index "organizations_legal_name_normalized_active_idx" to table: "organizations"
CREATE INDEX "organizations_legal_name_normalized_active_idx" ON "public"."organizations" ("legal_name_normalized") WHERE ((deleted_at IS NULL) AND is_active);
-- Create index "organizations_name_normalized_active_idx" to table: "organizations"
CREATE INDEX "organizations_name_normalized_active_idx" ON "public"."organizations" ("name_normalized") WHERE ((deleted_at IS NULL) AND is_active);
-- Create index "organizations_state_municipality_active_idx" to table: "organizations"
CREATE INDEX "organizations_state_municipality_active_idx" ON "public"."organizations" ("state_code", "municipality_code", "name_normalized") WHERE ((deleted_at IS NULL) AND is_active);
-- Modify "account_roles" table
ALTER TABLE "public"."account_roles" ADD CONSTRAINT "account_roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
