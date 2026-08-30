import { spawnSync } from 'node:child_process';
import pg from 'pg';

async function ensurePostgisInAtlasDevelopmentDatabase() {
  const databaseUrl = process.env.DB_ATLAS;
  if (!databaseUrl) return;

  const client = new pg.Client({
    connectionString: databaseUrl,
    application_name: 'protege-mais:atlas-schema-export',
  });

  try {
    await client.connect();
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis');
  } catch {
    throw new Error(
      'Não foi possível preparar PostGIS no banco descartável do Atlas.'
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}

await ensurePostgisInAtlasDevelopmentDatabase();

const drizzleExport = spawnSync('./node_modules/.bin/drizzle-kit', ['export'], {
  cwd: process.cwd(),
  encoding: 'utf8',
  env: process.env,
});

if (drizzleExport.error) throw drizzleExport.error;
if (drizzleExport.status !== 0) {
  process.stderr.write(drizzleExport.stderr);
  process.exit(drizzleExport.status ?? 1);
}

const quotedGeographyType = '"geography(Point,4326)"';
if (!drizzleExport.stdout.includes(quotedGeographyType)) {
  throw new Error(
    'O schema Drizzle não exportou o tipo geography(Point,4326) esperado.'
  );
}

process.stdout.write(
  drizzleExport.stdout.replaceAll(quotedGeographyType, 'geography(Point,4326)')
);
