import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  isPermissionCode,
  permissionCatalog,
  permissionCodes,
  type PermissionCode,
  type PermissionResource,
} from './index.js';

const expectedCatalog = {
  account: [
    'account.list',
    'account.view',
    'account.create',
    'account.update',
    'account.disable',
  ],
  organization: [
    'organization.list',
    'organization.view',
    'organization.create',
    'organization.update',
  ],
  victim: ['victim.list', 'victim.view', 'victim.create', 'victim.update'],
  case: [
    'case.list',
    'case.view',
    'case.create',
    'case.update',
    'case.close',
    'case.transfer',
  ],
} as const satisfies Record<PermissionResource, readonly PermissionCode[]>;

const permissionCodePattern = /^[a-z][a-z0-9_-]{0,62}\.[a-z][a-z0-9_-]{0,62}$/u;
const uuidV7Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

void test('catálogo expõe exatamente as permissões iniciais aprovadas', () => {
  assert.deepEqual(permissionCatalog, expectedCatalog);
  assert.deepEqual(permissionCodes, Object.values(expectedCatalog).flat());
  assert.equal(permissionCodes.length, 19);
});

void test('catálogo é imutável, único e coerente com cada recurso', () => {
  assert.equal(Object.isFrozen(permissionCatalog), true);
  assert.equal(Object.isFrozen(permissionCodes), true);
  assert.equal(new Set(permissionCodes).size, permissionCodes.length);

  for (const [resource, codes] of Object.entries(permissionCatalog)) {
    assert.equal(Object.isFrozen(codes), true);
    for (const code of codes) {
      assert.match(code, permissionCodePattern);
      assert.equal(code.startsWith(`${resource}.`), true);
      assert.ok(new TextEncoder().encode(code).length <= 127);
    }
  }
});

void test('identificação de PermissionCode rejeita valores fora do catálogo', () => {
  assert.equal(isPermissionCode('victim.view'), true);
  assert.equal(isPermissionCode('case.transfer'), true);
  assert.equal(isPermissionCode('account.delete'), false);
  assert.equal(isPermissionCode('victim.view.extra'), false);
  assert.equal(isPermissionCode('Victim.view'), false);
});

void test('seed versionado possui os mesmos códigos e nenhuma atribuição', async () => {
  const seedDirectory = new URL('../../../atlas/seed/dev/', import.meta.url);
  const seedNames = (await readdir(seedDirectory)).filter((name) =>
    name.endsWith('_initial_permission_catalog.sql')
  );
  assert.equal(seedNames.length, 1);
  const seedName = seedNames[0] ?? '';

  const seed = await readFile(new URL(seedName, seedDirectory), 'utf8');
  const entries = Array.from(
    seed.matchAll(/\('([0-9a-f-]+)', '([a-z0-9_.-]+)'\)/gu),
    (match) => ({ id: match[1] ?? '', code: match[2] ?? '' })
  );

  assert.deepEqual(
    entries.map((entry) => entry.code),
    permissionCodes
  );
  assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length);
  for (const entry of entries) assert.match(entry.id, uuidV7Pattern);

  assert.match(seed, /ON CONFLICT \("code"\) DO NOTHING;/u);
  assert.doesNotMatch(seed, /^\s*(?:DELETE|UPDATE|TRUNCATE|COPY)\b/gimu);
  assert.doesNotMatch(seed, /\b(?:roles|role_permissions|account_roles)\b/iu);

  const checksum = await readFile(new URL('atlas.sum', seedDirectory), 'utf8');
  assert.equal(
    checksum.split('\n').some((line) => line.startsWith(`${seedName} h1:`)),
    true
  );

  const productionDirectory = new URL('../../../atlas/prod/', import.meta.url);
  const productionMigrations = await Promise.all(
    (await readdir(productionDirectory))
      .filter((name) => name.endsWith('.sql'))
      .map((name) => readFile(new URL(name, productionDirectory), 'utf8'))
  );
  for (const productionMigration of productionMigrations) {
    for (const code of permissionCodes) {
      assert.equal(productionMigration.includes(`'${code}'`), false);
    }
  }
});
