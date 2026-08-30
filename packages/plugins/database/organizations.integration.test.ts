import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createUuidV7,
  isValidOrganizationCnpj,
  normalizeOrganizationName,
  normalizeOrganizationSearchText,
} from '@protege-mais/common';
import { databaseEnvironment } from '@protege-mais/config';
import {
  isOrganizationOperational,
  organizationConstraintNames,
  organizationIndexNames,
  organizations,
  serializePublicOrganization,
} from '@protege-mais/models';
import { inArray } from 'drizzle-orm';
import type { PoolClient } from 'pg';
import { createDatabaseConnection, type DatabaseLogger } from './index.js';

const logger: DatabaseLogger = {
  info: () => undefined,
  warn: () => undefined,
};

const insertOrganizationSql = `
  INSERT INTO organizations (
    id,
    name,
    name_normalized,
    legal_name,
    legal_name_normalized,
    type,
    cnpj,
    state_code,
    municipality_code,
    is_active,
    integration_enabled
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
`;

interface DatabaseErrorExpectation {
  readonly code: string;
  readonly constraint?: string;
}

function matchesDatabaseError(
  error: unknown,
  expectation: DatabaseErrorExpectation
): boolean {
  if (typeof error !== 'object' || error === null) return false;

  if ('code' in error && error.code === expectation.code) {
    return (
      expectation.constraint === undefined ||
      ('constraint' in error && error.constraint === expectation.constraint)
    );
  }

  return 'cause' in error && matchesDatabaseError(error.cause, expectation);
}

function createTestCnpj(body: string): string {
  for (let checkDigits = 0; checkDigits < 100; checkDigits += 1) {
    const cnpj = `${body}${checkDigits.toString().padStart(2, '0')}`;
    if (isValidOrganizationCnpj(cnpj)) return cnpj;
  }

  throw new Error('Não foi possível gerar um CNPJ fictício válido.');
}

function numericCnpjBody(source: string): string {
  return [...source.slice(0, 12)]
    .map((character) => (character.charCodeAt(0) % 10).toString())
    .join('');
}

function organizationValues(input: {
  readonly cnpj: string;
  readonly id?: string;
  readonly integrationEnabled?: boolean;
  readonly isActive?: boolean | string;
  readonly legalName?: string;
  readonly legalNameNormalized?: string;
  readonly municipalityCode?: string;
  readonly name?: string;
  readonly nameNormalized?: string;
  readonly stateCode?: string;
  readonly type?: string;
}): unknown[] {
  const name = input.name ?? 'Instituto Proteção de Teste';
  const legalName = input.legalName ?? 'Instituto Proteção de Teste e Pesquisa';

  return [
    input.id ?? createUuidV7(),
    name,
    input.nameNormalized ?? normalizeOrganizationSearchText(name),
    legalName,
    input.legalNameNormalized ?? normalizeOrganizationSearchText(legalName),
    input.type ?? 'nonprofit',
    input.cnpj,
    input.stateCode ?? 'SP',
    input.municipalityCode ?? '3550308',
    input.isActive ?? true,
    input.integrationEnabled ?? false,
  ];
}

let savepointSequence = 0;

async function rejectsAtSavepoint(
  client: PoolClient,
  values: unknown[],
  expectation: DatabaseErrorExpectation
): Promise<void> {
  savepointSequence += 1;
  const savepoint = `organization_rejection_${savepointSequence}`;

  await client.query(`SAVEPOINT ${savepoint}`);
  await assert.rejects(client.query(insertOrganizationSql, values), (error) =>
    matchesDatabaseError(error, expectation)
  );
  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
}

void test('organizations persiste formatos de CNPJ e projeta resposta segura', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:organizations-valid',
    logger,
  });
  const insertedIds: string[] = [];
  const suffix = createUuidV7().replaceAll('-', '');
  const displayName = normalizeOrganizationName(
    `  Instituto   Proteção ${suffix}  `
  );
  const legalName = `${displayName} de Teste`;
  const numericCnpj = createTestCnpj(numericCnpjBody(suffix));
  const alphanumericCnpj = createTestCnpj(
    `Z${suffix.slice(1, 12).toUpperCase()}`
  );

  try {
    await connection.connect();
    const [numericOrganization] = await connection.database
      .insert(organizations)
      .values({
        name: displayName,
        nameNormalized: normalizeOrganizationSearchText(displayName),
        legalName,
        legalNameNormalized: normalizeOrganizationSearchText(legalName),
        type: 'nonprofit',
        cnpj: numericCnpj,
        stateCode: 'SP',
        municipalityCode: '3550308',
        isActive: true,
        integrationEnabled: false,
      })
      .returning();
    assert.ok(numericOrganization);
    insertedIds.push(numericOrganization.id);
    assert.equal(numericOrganization.version, 1);
    assert.equal(isOrganizationOperational(numericOrganization), true);
    assert.equal(isValidOrganizationCnpj(numericOrganization.cnpj), true);

    const publicOrganization = serializePublicOrganization(numericOrganization);
    assert.equal(Object.hasOwn(publicOrganization, 'cnpj'), false);
    assert.equal(Object.hasOwn(publicOrganization, 'legalName'), false);
    assert.doesNotMatch(JSON.stringify(publicOrganization), /cnpj/iu);

    const [alphanumericOrganization] = await connection.database
      .insert(organizations)
      .values({
        name: `Organização Alfanumérica ${suffix}`,
        nameNormalized: normalizeOrganizationSearchText(
          `Organização Alfanumérica ${suffix}`
        ),
        legalName: `Organização Alfanumérica ${suffix} de Teste`,
        legalNameNormalized: normalizeOrganizationSearchText(
          `Organização Alfanumérica ${suffix} de Teste`
        ),
        type: 'private_organization',
        cnpj: alphanumericCnpj,
        stateCode: 'RJ',
        municipalityCode: '3304557',
        isActive: false,
        integrationEnabled: true,
      })
      .returning();
    assert.ok(alphanumericOrganization);
    insertedIds.push(alphanumericOrganization.id);
    assert.match(alphanumericOrganization.cnpj, /[A-Z]/u);
    assert.equal(isOrganizationOperational(alphanumericOrganization), false);
  } finally {
    if (insertedIds.length > 0) {
      await connection.database
        .delete(organizations)
        .where(inArray(organizations.id, insertedIds));
    }
    await connection.close();
  }
});

void test('organizations rejeita normalização, CNPJ e localidade inválidos', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:organizations-constraints',
    logger,
  });
  const client = await connection.pool.connect();
  const suffix = createUuidV7().replaceAll('-', '');
  const validCnpj = createTestCnpj(`Y${suffix.slice(1, 12).toUpperCase()}`);
  const invalidCheckDigits = `${validCnpj.slice(0, 13)}${
    validCnpj.endsWith('9') ? '8' : '9'
  }`;

  try {
    await client.query('BEGIN');

    await rejectsAtSavepoint(
      client,
      organizationValues({
        cnpj: validCnpj,
        nameNormalized: 'nome divergente',
      }),
      {
        code: '23514',
        constraint: organizationConstraintNames.nameNormalization,
      }
    );
    await rejectsAtSavepoint(
      client,
      organizationValues({
        cnpj: validCnpj,
        legalName: ' Razão social com espaço',
      }),
      {
        code: '23514',
        constraint: organizationConstraintNames.legalNameNormalization,
      }
    );
    await rejectsAtSavepoint(
      client,
      organizationValues({ cnpj: '12abc34501de35' }),
      {
        code: '23514',
        constraint: organizationConstraintNames.cnpjFormat,
      }
    );
    await rejectsAtSavepoint(
      client,
      organizationValues({ cnpj: invalidCheckDigits }),
      {
        code: '23514',
        constraint: organizationConstraintNames.cnpjCheckDigits,
      }
    );
    await rejectsAtSavepoint(
      client,
      organizationValues({ cnpj: '00000000000000' }),
      {
        code: '23514',
        constraint: organizationConstraintNames.cnpjFormat,
      }
    );
    await rejectsAtSavepoint(
      client,
      organizationValues({ cnpj: validCnpj, type: 'invalid_type' }),
      { code: '22P02' }
    );
    await rejectsAtSavepoint(
      client,
      organizationValues({ cnpj: validCnpj, isActive: 'invalid_status' }),
      { code: '22P02' }
    );
    await rejectsAtSavepoint(
      client,
      organizationValues({ cnpj: validCnpj, stateCode: 'XX' }),
      {
        code: '23514',
        constraint: organizationConstraintNames.stateCode,
      }
    );
    await rejectsAtSavepoint(
      client,
      organizationValues({ cnpj: validCnpj, municipalityCode: '355030' }),
      {
        code: '23514',
        constraint: organizationConstraintNames.municipalityCode,
      }
    );
    await rejectsAtSavepoint(
      client,
      organizationValues({ cnpj: validCnpj, municipalityCode: '3304557' }),
      {
        code: '23514',
        constraint: organizationConstraintNames.municipalityState,
      }
    );
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await connection.close();
  }
});

void test('CNPJ permanece reservado no soft delete e buscas ativas usam índices', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:organizations-lifecycle',
    logger,
  });
  const client = await connection.pool.connect();
  const organizationId = createUuidV7();
  const suffix = createUuidV7().replaceAll('-', '');
  const name = `Instituto Indexado ${suffix}`;
  const nameNormalized = normalizeOrganizationSearchText(name);
  const cnpj = createTestCnpj(`X${suffix.slice(1, 12).toUpperCase()}`);

  try {
    await client.query('BEGIN');
    await client.query(
      insertOrganizationSql,
      organizationValues({ cnpj, id: organizationId, name })
    );

    await rejectsAtSavepoint(
      client,
      organizationValues({ cnpj, name: `Duplicada ${suffix}` }),
      {
        code: '23505',
        constraint: organizationConstraintNames.cnpjUnique,
      }
    );

    const deleted = await client.query(
      `
        UPDATE organizations
        SET deleted_at = now(), updated_at = now(), version = version + 1
        WHERE id = $1 AND version = 1
      `,
      [organizationId]
    );
    assert.equal(deleted.rowCount, 1);

    await rejectsAtSavepoint(
      client,
      organizationValues({ cnpj, name: `Reutilização ${suffix}` }),
      {
        code: '23505',
        constraint: organizationConstraintNames.cnpjUnique,
      }
    );

    const staleUpdate = await client.query(
      `
        UPDATE organizations
        SET name = $2,
            name_normalized = $3,
            updated_at = now(),
            version = version + 1
        WHERE id = $1 AND version = 1
      `,
      [organizationId, `Estado obsoleto ${suffix}`, nameNormalized]
    );
    assert.equal(staleUpdate.rowCount, 0);

    const restored = await client.query(
      `
        UPDATE organizations
        SET deleted_at = NULL, updated_at = now(), version = version + 1
        WHERE id = $1 AND version = 2
      `,
      [organizationId]
    );
    assert.equal(restored.rowCount, 1);

    await client.query('SET LOCAL enable_seqscan = off');
    const namePlan = await client.query<{ readonly 'QUERY PLAN': string }>(
      `
        EXPLAIN (COSTS OFF)
        SELECT id
        FROM organizations
        WHERE name_normalized >= $1
          AND name_normalized < $2
          AND deleted_at IS NULL
          AND is_active
        ORDER BY name_normalized
      `,
      [nameNormalized, `${nameNormalized}\uffff`]
    );
    assert.match(
      namePlan.rows.map((row) => row['QUERY PLAN']).join('\n'),
      new RegExp(organizationIndexNames.activeName, 'u')
    );

    const municipalityPlan = await client.query<{
      readonly 'QUERY PLAN': string;
    }>(
      `
        EXPLAIN (COSTS OFF)
        SELECT id
        FROM organizations
        WHERE state_code = 'SP'
          AND municipality_code = '3550308'
          AND deleted_at IS NULL
          AND is_active
        ORDER BY state_code, municipality_code, name_normalized
      `
    );
    assert.match(
      municipalityPlan.rows.map((row) => row['QUERY PLAN']).join('\n'),
      new RegExp(organizationIndexNames.activeMunicipality, 'u')
    );
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await connection.close();
  }
});
