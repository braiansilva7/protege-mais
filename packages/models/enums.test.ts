import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fundamentalEnumCatalog } from '@protege-mais/common';
import {
  accountStatusEnum,
  accountTypeEnum,
  alertTriggerTypeEnum,
  caseStatusEnum,
  emergencyAlertStatusEnum,
  evidenceTypeEnum,
  incidentSeverityEnum,
  incidentTypeEnum,
  notificationChannelEnum,
  notificationStatusEnum,
  organizationTypeEnum,
  protectiveOrderTermStatusEnum,
  protectiveOrderTermTypeEnum,
  riskLevelEnum,
} from './index.js';

const databaseEnums = {
  accountStatus: accountStatusEnum,
  accountType: accountTypeEnum,
  organizationType: organizationTypeEnum,
  caseStatus: caseStatusEnum,
  riskLevel: riskLevelEnum,
  incidentType: incidentTypeEnum,
  incidentSeverity: incidentSeverityEnum,
  protectiveOrderTermStatus: protectiveOrderTermStatusEnum,
  protectiveOrderTermType: protectiveOrderTermTypeEnum,
  emergencyAlertStatus: emergencyAlertStatusEnum,
  alertTriggerType: alertTriggerTypeEnum,
  evidenceType: evidenceTypeEnum,
  notificationChannel: notificationChannelEnum,
  notificationStatus: notificationStatusEnum,
} as const;

void test('pgEnums reutilizam nomes e valores do catálogo TypeScript', () => {
  assert.deepEqual(
    Object.keys(databaseEnums),
    Object.keys(fundamentalEnumCatalog)
  );

  for (const key of Object.keys(
    fundamentalEnumCatalog
  ) as (keyof typeof fundamentalEnumCatalog)[]) {
    const definition = fundamentalEnumCatalog[key];
    const databaseEnum = databaseEnums[key];

    assert.equal(databaseEnum.enumName, definition.databaseName);
    assert.deepEqual(databaseEnum.enumValues, definition.values);
    assert.equal(databaseEnum.schema, undefined);
  }
});

void test('migration Atlas preserva paridade e não cria tabelas ou dados', async () => {
  const migrationDirectory = new URL('../../atlas/prod/', import.meta.url);
  const migrationNames = (await readdir(migrationDirectory)).filter((name) =>
    name.endsWith('_fundamental_enums.sql')
  );
  assert.equal(migrationNames.length, 1);

  const migration = await readFile(
    new URL(migrationNames[0] ?? '', migrationDirectory),
    'utf8'
  );
  const definitions = new Map<string, readonly string[]>();

  for (const match of migration.matchAll(
    /CREATE TYPE "public"\."(?<name>[a-z0-9_]+)" AS ENUM \((?<values>[^)]+)\);/gu
  )) {
    const name = match.groups?.name;
    const rawValues = match.groups?.values;
    if (name === undefined || rawValues === undefined) {
      throw new TypeError(
        'A migration contém uma declaração de enum inválida.'
      );
    }

    definitions.set(
      name,
      [...rawValues.matchAll(/'(?<value>[a-z0-9_]+)'/gu)].map(
        (valueMatch) => valueMatch.groups?.value ?? ''
      )
    );
  }

  assert.equal(definitions.size, Object.keys(fundamentalEnumCatalog).length);
  for (const definition of Object.values(fundamentalEnumCatalog)) {
    assert.deepEqual(
      definitions.get(definition.databaseName),
      definition.values
    );
  }

  assert.doesNotMatch(migration, /\bCREATE TABLE\b/iu);
  assert.doesNotMatch(migration, /\b(?:INSERT|COPY)\b/iu);
  assert.doesNotMatch(migration, /atlas\/seed/iu);
});
