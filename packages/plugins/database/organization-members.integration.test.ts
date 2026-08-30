import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createUuidV7,
  isValidOrganizationCnpj,
  normalizeAccountEmail,
  normalizeOrganizationMemberJobTitle,
  normalizeOrganizationMemberRegistrationNumber,
  normalizeOrganizationSearchText,
} from '@protege-mais/common';
import { databaseEnvironment } from '@protege-mais/config';
import {
  accounts,
  isOrganizationMemberActive,
  organizationMemberConstraintNames,
  organizationMemberIndexNames,
  organizationMembers,
  organizationUnits,
  organizations,
  serializePublicOrganizationMember,
} from '@protege-mais/models';
import { eq, inArray } from 'drizzle-orm';
import type { PoolClient } from 'pg';
import { createDatabaseConnection, type DatabaseLogger } from './index.js';

const logger: DatabaseLogger = {
  info: () => undefined,
  warn: () => undefined,
};

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

const insertAccountSql = `
  INSERT INTO accounts (
    id, email, email_normalized, password_hash, type, status, mfa_enabled
  )
  VALUES ($1, $2, $3, 'test-only-password-hash', 'person', 'active', false)
`;

const insertOrganizationSql = `
  INSERT INTO organizations (
    id, name, name_normalized, legal_name, legal_name_normalized,
    type, cnpj, state_code, municipality_code, is_active,
    integration_enabled
  )
  VALUES ($1, $2, $3, $4, $5, 'public_agency', $6, 'SP', '3550308', true, false)
`;

const insertUnitSql = `
  INSERT INTO organization_units (
    id, organization_id, name, name_normalized, code, type,
    address_street, address_number, address_district, postal_code,
    state_code, municipality_code, longitude, latitude, is_active
  )
  VALUES (
    $1, $2, $3, $4, $5, 'service_center', 'Avenida Proteção', '100',
    'Centro', '01310100', 'SP', '3550308', -46.633308, -23.55052, true
  )
`;

const insertMemberSql = `
  INSERT INTO organization_members (
    id, account_id, organization_id, organization_unit_id,
    registration_number, job_title, is_active
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7)
`;

function accountValues(accountId: string, suffix: string): unknown[] {
  const email = `member.${suffix}@example.test`;
  return [accountId, email, normalizeAccountEmail(email)];
}

function organizationValues(input: {
  readonly id: string;
  readonly marker: string;
  readonly suffix: string;
}): unknown[] {
  const name = `Organização ${input.marker} ${input.suffix}`;
  const legalName = `${name} de Teste`;
  const cnpjBody = `${input.marker}${input.suffix.slice(1, 12)}`.toUpperCase();

  return [
    input.id,
    name,
    normalizeOrganizationSearchText(name),
    legalName,
    normalizeOrganizationSearchText(legalName),
    createTestCnpj(cnpjBody),
  ];
}

function unitValues(input: {
  readonly id: string;
  readonly organizationId: string;
  readonly suffix: string;
}): unknown[] {
  const name = `Unidade de Teste ${input.suffix}`;
  return [
    input.id,
    input.organizationId,
    name,
    normalizeOrganizationSearchText(name),
    `MEMBER-${input.suffix.slice(0, 8).toUpperCase()}`,
  ];
}

function memberValues(input: {
  readonly accountId: string;
  readonly organizationId: string;
  readonly organizationUnitId?: string | null;
  readonly id?: string;
  readonly registrationNumber?: string | null;
  readonly jobTitle?: string | null;
  readonly isActive?: boolean;
}): unknown[] {
  return [
    input.id ?? createUuidV7(),
    input.accountId,
    input.organizationId,
    input.organizationUnitId ?? null,
    input.registrationNumber ?? null,
    input.jobTitle ?? null,
    input.isActive ?? true,
  ];
}

let savepointSequence = 0;

async function rejectsAtSavepoint(
  client: PoolClient,
  statement: string,
  values: unknown[],
  expectation: DatabaseErrorExpectation
): Promise<void> {
  savepointSequence += 1;
  const savepoint = `organization_member_rejection_${savepointSequence}`;

  await client.query(`SAVEPOINT ${savepoint}`);
  await assert.rejects(client.query(statement, values), (error: unknown) =>
    matchesDatabaseError(error, expectation)
  );
  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
}

void test('organization_members vincula conta à organização e unidade sem criar papel', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:organization-members-valid',
    logger,
  });
  const accountId = createUuidV7();
  const organizationIds = [createUuidV7(), createUuidV7()];
  const unitId = createUuidV7();
  const suffix = createUuidV7().replaceAll('-', '');

  try {
    await connection.connect();
    const email = `membership.${suffix}@example.test`;
    await connection.database.insert(accounts).values({
      id: accountId,
      email,
      emailNormalized: normalizeAccountEmail(email),
      passwordHash: 'test-only-password-hash',
      type: 'person',
      status: 'active',
      mfaEnabled: false,
    });
    await connection.database.insert(organizations).values([
      {
        id: organizationIds[0],
        name: `Organização A ${suffix}`,
        nameNormalized: normalizeOrganizationSearchText(
          `Organização A ${suffix}`
        ),
        legalName: `Organização A ${suffix} de Teste`,
        legalNameNormalized: normalizeOrganizationSearchText(
          `Organização A ${suffix} de Teste`
        ),
        type: 'public_agency',
        cnpj: createTestCnpj(suffix.slice(0, 12).toUpperCase()),
        stateCode: 'SP',
        municipalityCode: '3550308',
        isActive: true,
        integrationEnabled: false,
      },
      {
        id: organizationIds[1],
        name: `Organização B ${suffix}`,
        nameNormalized: normalizeOrganizationSearchText(
          `Organização B ${suffix}`
        ),
        legalName: `Organização B ${suffix} de Teste`,
        legalNameNormalized: normalizeOrganizationSearchText(
          `Organização B ${suffix} de Teste`
        ),
        type: 'nonprofit',
        cnpj: createTestCnpj(`A${suffix.slice(1, 12).toUpperCase()}`),
        stateCode: 'RJ',
        municipalityCode: '3304557',
        isActive: true,
        integrationEnabled: false,
      },
    ]);
    await connection.database.insert(organizationUnits).values({
      id: unitId,
      organizationId: organizationIds[0] ?? '',
      name: `Unidade A ${suffix}`,
      nameNormalized: normalizeOrganizationSearchText(`Unidade A ${suffix}`),
      code: `MEMBER-A-${suffix.slice(0, 8).toUpperCase()}`,
      type: 'service_center',
      addressStreet: 'Avenida Proteção',
      addressNumber: '100',
      addressDistrict: 'Centro',
      postalCode: '01310100',
      stateCode: 'SP',
      municipalityCode: '3550308',
      longitude: -46.633_308,
      latitude: -23.550_52,
      isActive: true,
    });

    const insertedMembers = await connection.database
      .insert(organizationMembers)
      .values([
        {
          accountId,
          organizationId: organizationIds[0] ?? '',
          registrationNumber:
            normalizeOrganizationMemberRegistrationNumber(' MAT-001 '),
          jobTitle: normalizeOrganizationMemberJobTitle(
            '  Assistente   Social '
          ),
          isActive: true,
        },
        {
          accountId,
          organizationId: organizationIds[0] ?? '',
          organizationUnitId: unitId,
          isActive: true,
        },
        {
          accountId,
          organizationId: organizationIds[1] ?? '',
          registrationNumber: null,
          jobTitle: null,
          isActive: true,
        },
      ])
      .returning();

    assert.equal(insertedMembers.length, 3);
    assert.equal(
      insertedMembers.every((member) => member.version === 1),
      true
    );
    assert.equal(insertedMembers.every(isOrganizationMemberActive), true);
    assert.deepEqual(
      new Set(insertedMembers.map((member) => member.organizationId)),
      new Set(organizationIds)
    );
    assert.equal(
      insertedMembers.some((member) => member.organizationUnitId === unitId),
      true
    );

    const publicMember = serializePublicOrganizationMember(
      insertedMembers[0] ??
        (() => {
          throw new Error('Vínculo organizacional não persistido.');
        })()
    );
    assert.equal(Object.hasOwn(publicMember, 'registrationNumber'), false);
    assert.equal(publicMember.jobTitle, 'Assistente Social');

    const roleTotal = await connection.pool.query<{ readonly total: number }>(
      `
        SELECT count(*)::integer AS total
        FROM account_roles
        WHERE account_id = $1
      `,
      [accountId]
    );
    assert.equal(roleTotal.rows[0]?.total, 0);

    const deactivatedMember = insertedMembers[1];
    assert.ok(deactivatedMember);
    const deactivation = await connection.pool.query(
      `
        UPDATE organization_members
        SET is_active = false, updated_at = now(), version = version + 1
        WHERE id = $1 AND version = $2
      `,
      [deactivatedMember.id, deactivatedMember.version]
    );
    assert.equal(deactivation.rowCount, 1);
    const activeMemberships = await connection.pool.query<{
      readonly total: number;
    }>(
      `
        SELECT count(*)::integer AS total
        FROM organization_members
        WHERE account_id = $1 AND is_active
      `,
      [accountId]
    );
    assert.equal(activeMemberships.rows[0]?.total, 2);

    const client = await connection.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL enable_seqscan = off');
      const plan = await client.query<{ readonly 'QUERY PLAN': string }>(
        `
          EXPLAIN (COSTS OFF)
          SELECT id
          FROM organization_members
          WHERE account_id = $1 AND is_active
          ORDER BY organization_id, organization_unit_id
        `,
        [accountId]
      );
      assert.match(
        plan.rows.map((row) => row['QUERY PLAN']).join('\n'),
        new RegExp(organizationMemberIndexNames.activeAccountContext, 'u')
      );
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  } finally {
    await connection.database
      .delete(organizationMembers)
      .where(eq(organizationMembers.accountId, accountId));
    await connection.database
      .delete(organizationUnits)
      .where(eq(organizationUnits.id, unitId));
    await connection.database
      .delete(organizations)
      .where(inArray(organizations.id, organizationIds));
    await connection.database
      .delete(accounts)
      .where(eq(accounts.id, accountId));
    await connection.close();
  }
});

void test('organization_members rejeita FKs, contexto divergente e duplicidade', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:organization-members-constraints',
    logger,
  });
  const client = await connection.pool.connect();
  const accountId = createUuidV7();
  const organizationAId = createUuidV7();
  const organizationBId = createUuidV7();
  const unitAId = createUuidV7();
  const suffix = createUuidV7().replaceAll('-', '');

  try {
    await client.query('BEGIN');
    await client.query(insertAccountSql, accountValues(accountId, suffix));
    await client.query(
      insertOrganizationSql,
      organizationValues({ id: organizationAId, marker: 'A', suffix })
    );
    await client.query(
      insertOrganizationSql,
      organizationValues({ id: organizationBId, marker: 'B', suffix })
    );
    await client.query(
      insertUnitSql,
      unitValues({ id: unitAId, organizationId: organizationAId, suffix })
    );
    await client.query(
      insertMemberSql,
      memberValues({
        accountId,
        organizationId: organizationAId,
        registrationNumber: 'MAT-001',
        jobTitle: 'Assistente Social',
      })
    );
    await client.query(
      insertMemberSql,
      memberValues({
        accountId,
        organizationId: organizationAId,
        organizationUnitId: unitAId,
      })
    );
    await client.query(
      insertMemberSql,
      memberValues({ accountId, organizationId: organizationBId })
    );

    await rejectsAtSavepoint(
      client,
      insertMemberSql,
      memberValues({
        accountId: createUuidV7(),
        organizationId: organizationAId,
      }),
      {
        code: '23503',
        constraint: organizationMemberConstraintNames.accountForeignKey,
      }
    );
    await rejectsAtSavepoint(
      client,
      insertMemberSql,
      memberValues({
        accountId,
        organizationId: createUuidV7(),
      }),
      {
        code: '23503',
        constraint: organizationMemberConstraintNames.organizationForeignKey,
      }
    );
    await rejectsAtSavepoint(
      client,
      insertMemberSql,
      memberValues({
        accountId,
        organizationId: organizationBId,
        organizationUnitId: unitAId,
      }),
      {
        code: '23503',
        constraint:
          organizationMemberConstraintNames.organizationUnitForeignKey,
      }
    );
    await rejectsAtSavepoint(
      client,
      insertMemberSql,
      memberValues({
        accountId,
        organizationId: organizationAId,
        organizationUnitId: createUuidV7(),
      }),
      {
        code: '23503',
        constraint:
          organizationMemberConstraintNames.organizationUnitForeignKey,
      }
    );
    await rejectsAtSavepoint(
      client,
      insertMemberSql,
      memberValues({ accountId, organizationId: organizationAId }),
      {
        code: '23505',
        constraint: organizationMemberConstraintNames.membershipContextUnique,
      }
    );
    await rejectsAtSavepoint(
      client,
      insertMemberSql,
      memberValues({
        accountId,
        organizationId: organizationAId,
        organizationUnitId: unitAId,
      }),
      {
        code: '23505',
        constraint: organizationMemberConstraintNames.membershipContextUnique,
      }
    );
    await rejectsAtSavepoint(
      client,
      insertMemberSql,
      memberValues({
        accountId,
        organizationId: organizationAId,
        organizationUnitId: createUuidV7(),
        registrationNumber: ' MAT-002',
      }),
      {
        code: '23514',
        constraint: organizationMemberConstraintNames.registrationNumber,
      }
    );
    await rejectsAtSavepoint(
      client,
      insertMemberSql,
      memberValues({
        accountId,
        organizationId: organizationAId,
        organizationUnitId: createUuidV7(),
        jobTitle: 'Assistente  Social',
      }),
      {
        code: '23514',
        constraint: organizationMemberConstraintNames.jobTitle,
      }
    );
    await rejectsAtSavepoint(
      client,
      `
        INSERT INTO organization_members (
          id, account_id, organization_id, is_active, version
        )
        VALUES ($1, $2, $3, true, 0)
      `,
      [createUuidV7(), accountId, organizationAId],
      {
        code: '23514',
        constraint: organizationMemberConstraintNames.version,
      }
    );

    await rejectsAtSavepoint(
      client,
      'DELETE FROM accounts WHERE id = $1',
      [accountId],
      {
        code: '23503',
        constraint: organizationMemberConstraintNames.accountForeignKey,
      }
    );
    await rejectsAtSavepoint(
      client,
      'DELETE FROM organization_units WHERE id = $1',
      [unitAId],
      {
        code: '23503',
        constraint:
          organizationMemberConstraintNames.organizationUnitForeignKey,
      }
    );
    await rejectsAtSavepoint(
      client,
      'DELETE FROM organizations WHERE id = $1',
      [organizationBId],
      {
        code: '23503',
        constraint: organizationMemberConstraintNames.organizationForeignKey,
      }
    );
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await connection.close();
  }
});

void test('vínculo usa atualização otimista e inatividade preserva a linha', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:organization-members-lifecycle',
    logger,
  });
  const client = await connection.pool.connect();
  const accountId = createUuidV7();
  const organizationId = createUuidV7();
  const memberId = createUuidV7();
  const suffix = createUuidV7().replaceAll('-', '');

  try {
    await client.query('BEGIN');
    await client.query(insertAccountSql, accountValues(accountId, suffix));
    await client.query(
      insertOrganizationSql,
      organizationValues({ id: organizationId, marker: 'L', suffix })
    );
    await client.query(
      insertMemberSql,
      memberValues({ id: memberId, accountId, organizationId })
    );

    const deactivated = await client.query(
      `
        UPDATE organization_members
        SET is_active = false, updated_at = now(), version = version + 1
        WHERE id = $1 AND version = 1
        RETURNING id, is_active AS "isActive", version
      `,
      [memberId]
    );
    assert.deepEqual(deactivated.rows[0], {
      id: memberId,
      isActive: false,
      version: 2,
    });

    const staleUpdate = await client.query(
      `
        UPDATE organization_members
        SET job_title = 'Estado obsoleto',
            updated_at = now(),
            version = version + 1
        WHERE id = $1 AND version = 1
      `,
      [memberId]
    );
    assert.equal(staleUpdate.rowCount, 0);

    const inactive = await client.query<{ readonly total: number }>(
      `
        SELECT count(*)::integer AS total
        FROM organization_members
        WHERE id = $1 AND is_active
      `,
      [memberId]
    );
    assert.equal(inactive.rows[0]?.total, 0);

    await rejectsAtSavepoint(
      client,
      insertMemberSql,
      memberValues({ accountId, organizationId }),
      {
        code: '23505',
        constraint: organizationMemberConstraintNames.membershipContextUnique,
      }
    );

    const reactivated = await client.query(
      `
        UPDATE organization_members
        SET is_active = true, updated_at = now(), version = version + 1
        WHERE id = $1 AND version = 2
      `,
      [memberId]
    );
    assert.equal(reactivated.rowCount, 1);
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await connection.close();
  }
});
