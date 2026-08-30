import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isValidOrganizationMemberJobTitle,
  isValidOrganizationMemberRegistrationNumber,
  normalizeOrganizationMemberJobTitle,
  normalizeOrganizationMemberRegistrationNumber,
  organizationMemberJobTitleMaximumLength,
  organizationMemberRegistrationNumberMaximumLength,
} from './index.js';

void test('normaliza matrícula e cargo sem alterar caixa ou acentos', () => {
  assert.equal(
    normalizeOrganizationMemberRegistrationNumber('  Mat-001 / A  '),
    'Mat-001 / A'
  );
  assert.equal(
    normalizeOrganizationMemberJobTitle('  Assistente   Social  '),
    'Assistente Social'
  );
});

void test('normalização de membership é idempotente', () => {
  const registrationNumber =
    normalizeOrganizationMemberRegistrationNumber('  REG   001  ');
  const jobTitle = normalizeOrganizationMemberJobTitle(
    '  Coordenadora   de Atendimento  '
  );

  assert.equal(
    normalizeOrganizationMemberRegistrationNumber(registrationNumber),
    registrationNumber
  );
  assert.equal(normalizeOrganizationMemberJobTitle(jobTitle), jobTitle);
});

void test('valida somente textos canônicos, não vazios e sem controles', () => {
  assert.equal(isValidOrganizationMemberRegistrationNumber('MAT-001'), true);
  assert.equal(
    isValidOrganizationMemberJobTitle('Coordenadora de Atendimento'),
    true
  );

  for (const invalid of ['', ' MAT-001', 'MAT  001', 'MAT\u0000001']) {
    assert.equal(isValidOrganizationMemberRegistrationNumber(invalid), false);
  }
  for (const invalid of ['', 'Cargo ', 'Cargo  duplicado', 'Cargo\nInterno']) {
    assert.equal(isValidOrganizationMemberJobTitle(invalid), false);
  }
});

void test('limites de matrícula e cargo correspondem ao contrato persistente', () => {
  assert.equal(
    isValidOrganizationMemberRegistrationNumber(
      'R'.repeat(organizationMemberRegistrationNumberMaximumLength)
    ),
    true
  );
  assert.equal(
    isValidOrganizationMemberRegistrationNumber(
      'R'.repeat(organizationMemberRegistrationNumberMaximumLength + 1)
    ),
    false
  );
  assert.equal(
    isValidOrganizationMemberJobTitle(
      'Á'.repeat(organizationMemberJobTitleMaximumLength)
    ),
    true
  );
  assert.equal(
    isValidOrganizationMemberJobTitle(
      'Á'.repeat(organizationMemberJobTitleMaximumLength + 1)
    ),
    false
  );
});
