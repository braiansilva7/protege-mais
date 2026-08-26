-- Fail before CREATE EXTENSION with an actionable diagnostic when the server
-- does not provide the PostGIS control files.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_available_extensions
    WHERE name = 'postgis'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '0A000',
      MESSAGE = 'PostGIS is not available on this PostgreSQL server.',
      HINT = 'Install PostGIS or use a PostGIS-compatible PostgreSQL image before applying this migration.';
  END IF;
END
$$;

CREATE EXTENSION IF NOT EXISTS postgis;
