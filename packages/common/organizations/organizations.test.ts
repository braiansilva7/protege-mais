import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  brazilianStateCodes,
  isBrazilianStateCode,
  isValidOrganizationCnpj,
  isValidOrganizationMunicipalityCode,
  normalizeOrganizationCnpj,
  normalizeOrganizationMunicipalityCode,
  normalizeOrganizationName,
  normalizeOrganizationSearchText,
  normalizeOrganizationStateCode,
} from './index.js';

void test('normaliza nomes institucionais e chaves de busca', () => {
  assert.equal(
    normalizeOrganizationName('  Instituto   Proteção\nIntegral  '),
    'Instituto Proteção Integral'
  );
  assert.equal(
    normalizeOrganizationSearchText('  Instituto   Proteção Integral  '),
    'instituto proteção integral'
  );
});

void test('normaliza e valida CNPJ numérico e alfanumérico', () => {
  assert.equal(
    normalizeOrganizationCnpj('12.ABC.345/01de-35'),
    '12ABC34501DE35'
  );
  assert.equal(isValidOrganizationCnpj('12.ABC.345/01DE-35'), true);
  assert.equal(isValidOrganizationCnpj('12.ABC.345/01DE-34'), false);
  assert.equal(isValidOrganizationCnpj('12.ABC.345/01DE-3X'), false);
  assert.equal(isValidOrganizationCnpj('00.000.000/0000-00'), false);
});

void test('normaliza UF e valida coerência do código de município', () => {
  assert.equal(normalizeOrganizationStateCode(' sp '), 'SP');
  assert.equal(normalizeOrganizationMunicipalityCode(' 3550308 '), '3550308');
  assert.equal(isBrazilianStateCode('SP'), true);
  assert.equal(isBrazilianStateCode('XX'), false);
  assert.equal(isValidOrganizationMunicipalityCode('3550308', 'SP'), true);
  assert.equal(isValidOrganizationMunicipalityCode('3304557', 'SP'), false);
  assert.equal(new Set(brazilianStateCodes).size, 27);
  assert.equal(Object.isFrozen(brazilianStateCodes), true);
});

void test('normalizações de organização são idempotentes', () => {
  const name = normalizeOrganizationName('Instituto Proteção');
  const searchText = normalizeOrganizationSearchText(name);
  const cnpj = normalizeOrganizationCnpj('12ABC34501DE35');
  const stateCode = normalizeOrganizationStateCode('SP');
  const municipalityCode = normalizeOrganizationMunicipalityCode('3550308');

  assert.equal(normalizeOrganizationName(name), name);
  assert.equal(normalizeOrganizationSearchText(searchText), searchText);
  assert.equal(normalizeOrganizationCnpj(cnpj), cnpj);
  assert.equal(normalizeOrganizationStateCode(stateCode), stateCode);
  assert.equal(
    normalizeOrganizationMunicipalityCode(municipalityCode),
    municipalityCode
  );
});
