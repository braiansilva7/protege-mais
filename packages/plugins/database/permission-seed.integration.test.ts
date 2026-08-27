import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  createUuidV7,
  normalizeAccountEmail,
  permissionCodes,
} from '@protege-mais/common';
import { databaseEnvironment } from '@protege-mais/config';
import type { PoolClient } from 'pg';
import { createDatabaseConnection, type DatabaseLogger } from './index.js';

const logger: DatabaseLogger = {
  info: () => undefined,
  warn: () => undefined,
};

async function readPermissionSeed(): Promise<string> {
  const seedDirectory = new URL('../../../atlas/seed/dev/', import.meta.url);
  const seedNames = (await readdir(seedDirectory)).filter((name) =>
    name.endsWith('_initial_permission_catalog.sql')
  );
  assert.equal(seedNames.length, 1);
  return readFile(new URL(seedNames[0] ?? '', seedDirectory), 'utf8');
}

async function selectSeededPermissions(client: PoolClient) {
  const result = await client.query<{
    readonly id: string;
    readonly code: string;
  }>(
    `
      SELECT id::text, code
      FROM permissions
      WHERE code = ANY($1::text[])
      ORDER BY array_position($1::text[], code)
    `,
    [[...permissionCodes]]
  );

  return result.rows;
}

void test('seed de permissões é idempotente e preserva atribuições locais', async () => {
  const configuration = databaseEnvironment();
  const connection = createDatabaseConnection({
    databaseUrl: configuration.databaseUrl,
    applicationName: 'protege-mais:permission-seed',
    logger,
  });
  const client = await connection.pool.connect();
  const accountId = createUuidV7();
  const roleId = createUuidV7();
  const proposedPermissionId = createUuidV7();
  const accountRoleId = createUuidV7();
  const suffix = createUuidV7().replaceAll('-', '');
  const localPermissionCode = permissionCodes[0];
  const seed = await readPermissionSeed();

  try {
    await client.query('BEGIN');
    const email = `permission.seed.${suffix}@example.test`;
    await client.query(
      `
        INSERT INTO accounts (
          id, email, email_normalized, password_hash, type, status, mfa_enabled
        )
        VALUES ($1, $2, $3, $4, 'person', 'active', false)
      `,
      [
        accountId,
        email,
        normalizeAccountEmail(email),
        'test-only-password-hash',
      ]
    );
    await client.query(
      `
        INSERT INTO roles (id, code, is_system, is_active)
        VALUES ($1, $2, false, true)
      `,
      [roleId, `local_${suffix}`]
    );
    await client.query(
      `
        INSERT INTO permissions (id, code)
        VALUES ($1, $2)
        ON CONFLICT (code) DO NOTHING
      `,
      [proposedPermissionId, localPermissionCode]
    );
    const localPermission = await client.query<{ readonly id: string }>(
      'SELECT id::text FROM permissions WHERE code = $1',
      [localPermissionCode]
    );
    const localPermissionId = localPermission.rows[0]?.id;
    assert.ok(localPermissionId);
    await client.query(
      `
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
      `,
      [roleId, localPermissionId]
    );
    await client.query(
      `
        INSERT INTO account_roles (id, account_id, role_id)
        VALUES ($1, $2, $3)
      `,
      [accountRoleId, accountId, roleId]
    );

    await client.query(seed);
    const firstApplication = await selectSeededPermissions(client);
    await client.query(seed);
    const secondApplication = await selectSeededPermissions(client);

    assert.deepEqual(
      firstApplication.map((permission) => permission.code),
      permissionCodes
    );
    assert.deepEqual(secondApplication, firstApplication);

    const preservedLocalState = await client.query<{
      readonly permissions: number;
      readonly rolePermissions: number;
      readonly accountRoles: number;
    }>(
      `
        SELECT
          (
            SELECT count(*)::integer
            FROM permissions
            WHERE id = $1 AND code = $2
          ) AS permissions,
          (
            SELECT count(*)::integer
            FROM role_permissions
            WHERE role_id = $3 AND permission_id = $1
          ) AS "rolePermissions",
          (
            SELECT count(*)::integer
            FROM account_roles
            WHERE id = $4 AND account_id = $5 AND role_id = $3
          ) AS "accountRoles"
      `,
      [localPermissionId, localPermissionCode, roleId, accountRoleId, accountId]
    );
    assert.deepEqual(preservedLocalState.rows[0], {
      permissions: 1,
      rolePermissions: 1,
      accountRoles: 1,
    });
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await connection.close();
  }
});
