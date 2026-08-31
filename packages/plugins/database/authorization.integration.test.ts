import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createUuidV7,
  isValidOrganizationCnpj,
  normalizeAccountEmail,
  normalizeOrganizationSearchText,
} from '@protege-mais/common';
import { databaseEnvironment } from '@protege-mais/config';
import {
  accountRoles,
  accounts,
  authorizationConstraintNames,
  authorizationIndexNames,
  organizationUnits,
  organizations,
  permissions,
  rolePermissions,
  roles,
} from '@protege-mais/models';
import { eq, inArray } from 'drizzle-orm';
import type { PoolClient } from 'pg';
import { createDatabaseConnection, type DatabaseLogger } from './index.js';

const logger: DatabaseLogger = {
  info: () => undefined,
  warn: () => undefined,
};

function createTestCnpj(body: string): string {
  for (let checkDigits = 0; checkDigits < 100; checkDigits += 1) {
    const cnpj = `${body}${checkDigits.toString().padStart(2, '0')}`;
    if (isValidOrganizationCnpj(cnpj)) return cnpj;
  }

  throw new Error('Não foi possível gerar um CNPJ fictício válido.');
}

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

let savepointSequence = 0;

async function rejectsAtSavepoint(
  client: PoolClient,
  statement: string,
  values: unknown[],
  expectation: DatabaseErrorExpectation
): Promise<void> {
  savepointSequence += 1;
  const savepoint = `authorization_rejection_${savepointSequence}`;

  await client.query(`SAVEPOINT ${savepoint}`);
  await assert.rejects(client.query(statement, values), (error: unknown) =>
    matchesDatabaseError(error, expectation)
  );
  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
}

const contextualPermissionQuery = `
  SELECT DISTINCT permission.code
  FROM account_roles AS account_role
  INNER JOIN roles AS role
    ON role.id = account_role.role_id
   AND role.is_active
  INNER JOIN role_permissions AS role_permission
    ON role_permission.role_id = role.id
  INNER JOIN permissions AS permission
    ON permission.id = role_permission.permission_id
  WHERE account_role.account_id = $1
    AND (
      (
        account_role.organization_id IS NULL
        AND account_role.organization_unit_id IS NULL
      )
      OR (
        account_role.organization_id = $2
        AND (
          account_role.organization_unit_id IS NULL
          OR account_role.organization_unit_id = $3
        )
      )
    )
`;

void test('consulta RBAC retorna permissões globais e do contexto solicitado', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:authorization-context',
    logger,
  });
  const accountId = createUuidV7();
  const roleIds = Array.from({ length: 5 }, () => createUuidV7());
  const permissionIds = Array.from({ length: 5 }, () => createUuidV7());
  const organizationAId = createUuidV7();
  const organizationBId = createUuidV7();
  const unitAId = createUuidV7();
  const suffix = createUuidV7().replaceAll('-', '');

  try {
    await connection.connect();
    const email = `authorization.${suffix}@example.test`;
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
        id: organizationAId,
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
        id: organizationBId,
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
      id: unitAId,
      organizationId: organizationAId,
      name: `Unidade A ${suffix}`,
      nameNormalized: normalizeOrganizationSearchText(`Unidade A ${suffix}`),
      code: `UNIT-A-${suffix.slice(0, 8).toUpperCase()}`,
      type: 'service_center',
      contactEmail: null,
      contactPhoneE164: null,
      addressStreet: 'Avenida Proteção',
      addressNumber: '100',
      addressComplement: null,
      addressDistrict: 'Centro',
      postalCode: '01310100',
      stateCode: 'SP',
      municipalityCode: '3550308',
      longitude: -46.633_308,
      latitude: -23.550_52,
      isActive: true,
    });
    await connection.database.insert(roles).values([
      {
        id: roleIds[0],
        code: `global_${suffix}`,
        isSystem: false,
        isActive: true,
      },
      {
        id: roleIds[1],
        code: `organization_${suffix}`,
        isSystem: false,
        isActive: true,
      },
      {
        id: roleIds[2],
        code: `unit_${suffix}`,
        isSystem: false,
        isActive: true,
      },
      {
        id: roleIds[3],
        code: `other_${suffix}`,
        isSystem: false,
        isActive: true,
      },
      {
        id: roleIds[4],
        code: `inactive_${suffix}`,
        isSystem: false,
        isActive: false,
      },
    ]);
    await connection.database.insert(permissions).values([
      { id: permissionIds[0], code: `global_${suffix}.view` },
      { id: permissionIds[1], code: `organization_${suffix}.view` },
      { id: permissionIds[2], code: `unit_${suffix}.view` },
      { id: permissionIds[3], code: `other_${suffix}.view` },
      { id: permissionIds[4], code: `inactive_${suffix}.view` },
    ]);
    await connection.database.insert(rolePermissions).values(
      roleIds.map((roleId, index) => ({
        roleId,
        permissionId: permissionIds[index] ?? '',
      }))
    );
    await connection.database.insert(accountRoles).values([
      { accountId, roleId: roleIds[0] ?? '' },
      {
        accountId,
        roleId: roleIds[1] ?? '',
        organizationId: organizationAId,
      },
      {
        accountId,
        roleId: roleIds[2] ?? '',
        organizationId: organizationAId,
        organizationUnitId: unitAId,
      },
      {
        accountId,
        roleId: roleIds[3] ?? '',
        organizationId: organizationBId,
      },
      { accountId, roleId: roleIds[4] ?? '' },
      {
        accountId,
        roleId: roleIds[1] ?? '',
        organizationId: organizationBId,
      },
    ]);

    const contextualPermissions = await connection.pool.query<{
      readonly code: string;
    }>(`${contextualPermissionQuery} ORDER BY permission.code`, [
      accountId,
      organizationAId,
      unitAId,
    ]);
    assert.deepEqual(
      contextualPermissions.rows.map((row) => row.code),
      [
        `global_${suffix}.view`,
        `organization_${suffix}.view`,
        `unit_${suffix}.view`,
      ]
    );

    const organizationPermissions = await connection.pool.query<{
      readonly code: string;
    }>(`${contextualPermissionQuery} ORDER BY permission.code`, [
      accountId,
      organizationBId,
      null,
    ]);
    assert.deepEqual(
      organizationPermissions.rows.map((row) => row.code),
      [
        `global_${suffix}.view`,
        `organization_${suffix}.view`,
        `other_${suffix}.view`,
      ]
    );

    const client = await connection.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL enable_seqscan = off');
      const plan = await client.query<{ readonly 'QUERY PLAN': string }>(
        `EXPLAIN (COSTS OFF) ${contextualPermissionQuery}`,
        [accountId, organizationAId, unitAId]
      );
      assert.match(
        plan.rows.map((row) => row['QUERY PLAN']).join('\n'),
        new RegExp(
          `${authorizationIndexNames.accountRolesContextLookup}|${authorizationConstraintNames.accountRolesContextUnique}`,
          'u'
        )
      );
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  } finally {
    await connection.database
      .delete(accountRoles)
      .where(eq(accountRoles.accountId, accountId));
    await connection.database
      .delete(rolePermissions)
      .where(inArray(rolePermissions.roleId, roleIds));
    await connection.database
      .delete(permissions)
      .where(inArray(permissions.id, permissionIds));
    await connection.database.delete(roles).where(inArray(roles.id, roleIds));
    await connection.database
      .delete(organizationUnits)
      .where(eq(organizationUnits.id, unitAId));
    await connection.database
      .delete(organizations)
      .where(inArray(organizations.id, [organizationAId, organizationBId]));
    await connection.database
      .delete(accounts)
      .where(eq(accounts.id, accountId));
    await connection.close();
  }
});

void test('constraints rejeitam duplicidade, escopo incoerente e remoção referenciada', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:authorization-constraints',
    logger,
  });
  const client = await connection.pool.connect();
  const accountId = createUuidV7();
  const roleId = createUuidV7();
  const systemRoleId = createUuidV7();
  const permissionId = createUuidV7();
  const organizationAId = createUuidV7();
  const organizationBId = createUuidV7();
  const unitAId = createUuidV7();
  const unitBId = createUuidV7();
  const suffix = createUuidV7().replaceAll('-', '');
  const roleCode = `role_${suffix}`;
  const permissionCode = `resource_${suffix}.view`;

  try {
    await client.query('BEGIN');
    const email = `constraints.${suffix}@example.test`;
    await client.query(
      `
        INSERT INTO accounts (
          id, email, email_normalized, password_hash, type, status, mfa_enabled
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        accountId,
        email,
        normalizeAccountEmail(email),
        'test-only-password-hash',
        'person',
        'active',
        false,
      ]
    );
    await client.query(
      `
        INSERT INTO roles (id, code, is_system, is_active)
        VALUES ($1, $2, false, true), ($3, $4, true, true)
      `,
      [roleId, roleCode, systemRoleId, `system_${suffix}`]
    );
    await client.query('INSERT INTO permissions (id, code) VALUES ($1, $2)', [
      permissionId,
      permissionCode,
    ]);
    await client.query(
      `
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2), ($3, $2)
      `,
      [roleId, permissionId, systemRoleId]
    );
    const organizationNameA = `Organização A ${suffix}`;
    const organizationNameB = `Organização B ${suffix}`;
    await client.query(
      `
        INSERT INTO organizations (
          id, name, name_normalized, legal_name, legal_name_normalized,
          type, cnpj, state_code, municipality_code, is_active,
          integration_enabled
        )
        VALUES
          ($1, $2, $3, $4, $5, 'public_agency', $6, 'SP', '3550308', true, false),
          ($7, $8, $9, $10, $11, 'nonprofit', $12, 'RJ', '3304557', true, false)
      `,
      [
        organizationAId,
        organizationNameA,
        normalizeOrganizationSearchText(organizationNameA),
        `${organizationNameA} de Teste`,
        normalizeOrganizationSearchText(`${organizationNameA} de Teste`),
        createTestCnpj(suffix.slice(0, 12).toUpperCase()),
        organizationBId,
        organizationNameB,
        normalizeOrganizationSearchText(organizationNameB),
        `${organizationNameB} de Teste`,
        normalizeOrganizationSearchText(`${organizationNameB} de Teste`),
        createTestCnpj(`B${suffix.slice(1, 12).toUpperCase()}`),
      ]
    );
    await client.query(
      `
        INSERT INTO organization_units (
          id, organization_id, name, name_normalized, code, type,
          address_street, address_number, address_district, postal_code,
          state_code, municipality_code, longitude, latitude, is_active
        )
        VALUES
          ($1, $2, $3, $4, $5, 'service_center', 'Avenida Proteção', '100',
           'Centro', '01310100', 'SP', '3550308', -46.633308, -23.55052, true),
          ($6, $7, $8, $9, $10, 'service_center', 'Avenida Proteção', '200',
           'Centro', '20040002', 'RJ', '3304557', -43.1729, -22.9068, true)
      `,
      [
        unitAId,
        organizationAId,
        `Unidade A ${suffix}`,
        normalizeOrganizationSearchText(`Unidade A ${suffix}`),
        `UNIT-A-${suffix.slice(0, 8).toUpperCase()}`,
        unitBId,
        organizationBId,
        `Unidade B ${suffix}`,
        normalizeOrganizationSearchText(`Unidade B ${suffix}`),
        `UNIT-B-${suffix.slice(0, 8).toUpperCase()}`,
      ]
    );
    await client.query(
      `
        INSERT INTO account_roles (id, account_id, role_id)
        VALUES ($1, $2, $3)
      `,
      [createUuidV7(), accountId, roleId]
    );

    await rejectsAtSavepoint(
      client,
      'INSERT INTO roles (id, code, is_system, is_active) VALUES ($1, $2, false, true)',
      [createUuidV7(), roleCode],
      {
        code: '23505',
        constraint: authorizationConstraintNames.roleCodeUnique,
      }
    );
    await rejectsAtSavepoint(
      client,
      `
        INSERT INTO account_roles (
          id, account_id, role_id, organization_id, organization_unit_id
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [createUuidV7(), accountId, roleId, organizationAId, unitBId],
      {
        code: '23503',
        constraint:
          authorizationConstraintNames.accountRolesOrganizationUnitForeignKey,
      }
    );
    await rejectsAtSavepoint(
      client,
      `
        INSERT INTO account_roles (
          id, account_id, role_id, organization_id, organization_unit_id
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [createUuidV7(), accountId, roleId, organizationAId, createUuidV7()],
      {
        code: '23503',
        constraint:
          authorizationConstraintNames.accountRolesOrganizationUnitForeignKey,
      }
    );
    await rejectsAtSavepoint(
      client,
      'INSERT INTO roles (id, code, is_system, is_active) VALUES ($1, $2, false, true)',
      [createUuidV7(), 'Role Invalida'],
      {
        code: '23514',
        constraint: authorizationConstraintNames.roleCodeCheck,
      }
    );
    await rejectsAtSavepoint(
      client,
      'INSERT INTO permissions (id, code) VALUES ($1, $2)',
      [createUuidV7(), permissionCode],
      {
        code: '23505',
        constraint: authorizationConstraintNames.permissionCodeUnique,
      }
    );
    await rejectsAtSavepoint(
      client,
      'INSERT INTO permissions (id, code) VALUES ($1, $2)',
      [createUuidV7(), 'resource-without-action'],
      {
        code: '23514',
        constraint: authorizationConstraintNames.permissionCodeCheck,
      }
    );
    await rejectsAtSavepoint(
      client,
      'INSERT INTO permissions (id, code) VALUES ($1, NULL)',
      [createUuidV7()],
      { code: '23502' }
    );
    await rejectsAtSavepoint(
      client,
      'UPDATE roles SET is_active = false WHERE id = $1',
      [systemRoleId],
      {
        code: '23514',
        constraint: authorizationConstraintNames.roleSystemStateCheck,
      }
    );
    await rejectsAtSavepoint(
      client,
      'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
      [roleId, permissionId],
      {
        code: '23505',
        constraint: authorizationConstraintNames.rolePermissionsPrimaryKey,
      }
    );
    await rejectsAtSavepoint(
      client,
      `
        INSERT INTO account_roles (
          id, account_id, role_id, organization_id
        )
        VALUES ($1, $2, $3, $4)
      `,
      [createUuidV7(), accountId, roleId, createUuidV7()],
      {
        code: '23503',
        constraint:
          authorizationConstraintNames.accountRolesOrganizationForeignKey,
      }
    );
    await rejectsAtSavepoint(
      client,
      `
        INSERT INTO account_roles (id, account_id, role_id)
        VALUES ($1, $2, $3)
      `,
      [createUuidV7(), accountId, roleId],
      {
        code: '23505',
        constraint: authorizationConstraintNames.accountRolesContextUnique,
      }
    );
    await rejectsAtSavepoint(
      client,
      `
        INSERT INTO account_roles (
          id, account_id, role_id, organization_unit_id
        )
        VALUES ($1, $2, $3, $4)
      `,
      [createUuidV7(), accountId, roleId, createUuidV7()],
      {
        code: '23514',
        constraint: authorizationConstraintNames.accountRolesScopeCheck,
      }
    );
    await rejectsAtSavepoint(
      client,
      'INSERT INTO account_roles (id, account_id, role_id) VALUES ($1, $2, $3)',
      [createUuidV7(), createUuidV7(), roleId],
      {
        code: '23503',
        constraint: authorizationConstraintNames.accountRolesAccountForeignKey,
      }
    );
    await rejectsAtSavepoint(
      client,
      'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
      [roleId, createUuidV7()],
      {
        code: '23503',
        constraint:
          authorizationConstraintNames.rolePermissionsPermissionForeignKey,
      }
    );

    await client.query(
      `
        INSERT INTO account_roles (
          id, account_id, role_id, organization_id
        )
        VALUES ($1, $2, $3, $4), ($5, $2, $3, $6)
      `,
      [
        createUuidV7(),
        accountId,
        roleId,
        organizationAId,
        createUuidV7(),
        organizationBId,
      ]
    );
    await client.query(
      `
        INSERT INTO account_roles (
          id, account_id, role_id, organization_id, organization_unit_id
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [createUuidV7(), accountId, roleId, organizationAId, unitAId]
    );
    const contextualAssignments = await client.query<{
      readonly total: number;
    }>(
      `
        SELECT count(*)::integer AS total
        FROM account_roles
        WHERE account_id = $1 AND role_id = $2
      `,
      [accountId, roleId]
    );
    assert.equal(contextualAssignments.rows[0]?.total, 4);

    const systemRoleUpdate = await client.query(
      `
        UPDATE roles
        SET code = $2, updated_at = now(), version = version + 1
        WHERE id = $1 AND NOT is_system AND version = 1
        RETURNING id
      `,
      [systemRoleId, `blocked_${suffix}`]
    );
    assert.equal(systemRoleUpdate.rowCount, 0);
    const systemPermissionRemoval = await client.query(
      `
        DELETE FROM role_permissions AS role_permission
        USING roles AS role
        WHERE role_permission.role_id = $1
          AND role.id = role_permission.role_id
          AND NOT role.is_system
        RETURNING role_permission.role_id
      `,
      [systemRoleId]
    );
    assert.equal(systemPermissionRemoval.rowCount, 0);

    await rejectsAtSavepoint(
      client,
      'DELETE FROM permissions WHERE id = $1',
      [permissionId],
      { code: '23503' }
    );
    await rejectsAtSavepoint(
      client,
      'DELETE FROM roles WHERE id = $1',
      [roleId],
      { code: '23503' }
    );
    await rejectsAtSavepoint(
      client,
      'DELETE FROM accounts WHERE id = $1',
      [accountId],
      {
        code: '23503',
        constraint: authorizationConstraintNames.accountRolesAccountForeignKey,
      }
    );
    await rejectsAtSavepoint(
      client,
      'DELETE FROM organization_units WHERE id = $1',
      [unitAId],
      {
        code: '23503',
        constraint:
          authorizationConstraintNames.accountRolesOrganizationUnitForeignKey,
      }
    );
    await rejectsAtSavepoint(
      client,
      'DELETE FROM organizations WHERE id = $1',
      [organizationAId],
      {
        code: '23503',
        constraint:
          authorizationConstraintNames.accountRolesOrganizationForeignKey,
      }
    );
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await connection.close();
  }
});
