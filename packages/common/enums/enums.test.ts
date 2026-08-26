import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  accountStatusValues,
  fundamentalEnumCatalog,
  type AccountStatus,
  type FundamentalEnumKey,
} from './index.js';

const expectedKeys = [
  'accountStatus',
  'accountType',
  'organizationType',
  'caseStatus',
  'riskLevel',
  'incidentType',
  'incidentSeverity',
  'protectiveOrderTermStatus',
  'protectiveOrderTermType',
  'emergencyAlertStatus',
  'alertTriggerType',
  'evidenceType',
  'notificationChannel',
  'notificationStatus',
] as const satisfies readonly FundamentalEnumKey[];

const snakeCasePattern = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u;

void test('catálogo fundamental expõe exatamente os enums aprovados', () => {
  assert.deepEqual(Object.keys(fundamentalEnumCatalog), expectedKeys);
  assert.equal(Object.isFrozen(fundamentalEnumCatalog), true);
});

void test('nomes e valores são não vazios, únicos e snake_case', () => {
  const databaseNames = new Set<string>();

  for (const definition of Object.values(fundamentalEnumCatalog)) {
    assert.equal(Object.isFrozen(definition), true);
    assert.equal(Object.isFrozen(definition.values), true);
    assert.match(definition.databaseName, snakeCasePattern);
    assert.ok(new TextEncoder().encode(definition.databaseName).length <= 63);
    assert.equal(databaseNames.has(definition.databaseName), false);
    databaseNames.add(definition.databaseName);

    assert.ok(definition.values.length > 0);
    assert.equal(new Set(definition.values).size, definition.values.length);
    for (const value of definition.values) {
      assert.match(value, snakeCasePattern);
      assert.ok(new TextEncoder().encode(value).length <= 63);
    }
  }
});

void test('tipos TypeScript derivam da mesma tuple usada pelo catálogo', () => {
  const status: AccountStatus = accountStatusValues[0];

  assert.equal(status, 'active');
  assert.equal(
    fundamentalEnumCatalog.accountStatus.values,
    accountStatusValues
  );
});
