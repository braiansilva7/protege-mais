import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isValidOrganizationUnitCode,
  isValidOrganizationUnitContactEmail,
  isValidOrganizationUnitPhoneE164,
  isValidOrganizationUnitPosition,
  isValidOrganizationUnitPostalCode,
  isValidOrganizationUnitType,
  normalizeOrganizationUnitAddressPart,
  normalizeOrganizationUnitCode,
  normalizeOrganizationUnitContactEmail,
  normalizeOrganizationUnitMunicipalityCode,
  normalizeOrganizationUnitName,
  normalizeOrganizationUnitPhoneE164,
  normalizeOrganizationUnitPostalCode,
  normalizeOrganizationUnitSearchText,
  normalizeOrganizationUnitStateCode,
  normalizeOrganizationUnitType,
} from './index.js';

void test('normaliza identidade técnica e apresentação da unidade', () => {
  assert.equal(
    normalizeOrganizationUnitName('  Unidade   Centro\n24h  '),
    'Unidade Centro 24h'
  );
  assert.equal(
    normalizeOrganizationUnitSearchText('  Unidade   Centro 24H  '),
    'unidade centro 24h'
  );
  assert.equal(
    normalizeOrganizationUnitCode('  sp-centro.01  '),
    'SP-CENTRO.01'
  );
  assert.equal(
    normalizeOrganizationUnitType('  Service_Center  '),
    'service_center'
  );
  assert.equal(isValidOrganizationUnitCode('SP-CENTRO.01'), true);
  assert.equal(isValidOrganizationUnitCode('código inválido'), false);
  assert.equal(isValidOrganizationUnitType('service_center'), true);
  assert.equal(isValidOrganizationUnitType('Service-Center'), false);
});

void test('normaliza e valida contatos canônicos', () => {
  assert.equal(
    normalizeOrganizationUnitContactEmail('  Plantao@Example.COM  '),
    'plantao@example.com'
  );
  assert.equal(
    isValidOrganizationUnitContactEmail('plantao@example.com'),
    true
  );
  assert.equal(isValidOrganizationUnitContactEmail('plantao@'), false);
  assert.equal(
    normalizeOrganizationUnitPhoneE164('  +5511999999999  '),
    '+5511999999999'
  );
  assert.equal(isValidOrganizationUnitPhoneE164('+5511999999999'), true);
  assert.equal(isValidOrganizationUnitPhoneE164('11999999999'), false);
});

void test('normaliza endereço brasileiro sem descartar entrada desconhecida', () => {
  assert.equal(
    normalizeOrganizationUnitAddressPart('  Avenida   Proteção\nIntegral  '),
    'Avenida Proteção Integral'
  );
  assert.equal(normalizeOrganizationUnitPostalCode(' 01310-100 '), '01310100');
  assert.equal(normalizeOrganizationUnitPostalCode('01310X100'), '01310X100');
  assert.equal(isValidOrganizationUnitPostalCode('01310100'), true);
  assert.equal(isValidOrganizationUnitPostalCode('01310X100'), false);
  assert.equal(normalizeOrganizationUnitStateCode(' sp '), 'SP');
  assert.equal(
    normalizeOrganizationUnitMunicipalityCode(' 3550308 '),
    '3550308'
  );
});

void test('valida os limites geográficos sem aceitar NaN ou infinito', () => {
  for (const [longitude, latitude] of [
    [-180, -90],
    [0, 0],
    [180, 90],
    [-46.633_308, -23.550_52],
  ]) {
    assert.equal(isValidOrganizationUnitPosition(longitude, latitude), true);
  }

  for (const [longitude, latitude] of [
    [-180.000_001, 0],
    [180.000_001, 0],
    [0, -90.000_001],
    [0, 90.000_001],
    [Number.NaN, 0],
    [0, Number.POSITIVE_INFINITY],
  ]) {
    assert.equal(isValidOrganizationUnitPosition(longitude, latitude), false);
  }
});

void test('normalizações de unidade são idempotentes', () => {
  const normalizers = [
    normalizeOrganizationUnitName,
    normalizeOrganizationUnitSearchText,
    normalizeOrganizationUnitCode,
    normalizeOrganizationUnitType,
    normalizeOrganizationUnitContactEmail,
    normalizeOrganizationUnitPhoneE164,
    normalizeOrganizationUnitAddressPart,
    normalizeOrganizationUnitPostalCode,
    normalizeOrganizationUnitStateCode,
    normalizeOrganizationUnitMunicipalityCode,
  ];

  for (const normalize of normalizers) {
    const once = normalize('  SP  ');
    assert.equal(normalize(once), once);
  }
});
