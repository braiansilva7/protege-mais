import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  authenticationEmailMaximumLength,
  authenticationPasswordMaximumLength,
  authenticationPasswordMinimumLength,
  isAuthenticationEmailLookupCandidate,
  isAuthenticationPasswordWithinMaximumLength,
  isValidNewAuthenticationPassword,
  normalizeAuthenticationPassword,
} from './index.js';

void test('normaliza senha em NFC sem alterar espaços ou caixa', () => {
  assert.equal(
    normalizeAuthenticationPassword('Senha Á Segura'),
    'Senha Á Segura'
  );
  assert.equal(
    normalizeAuthenticationPassword('  Senha Segura  '),
    '  Senha Segura  '
  );
});

void test('política aceita passphrases sem regra de composição', () => {
  assert.equal(
    isValidNewAuthenticationPassword('frase longa inteiramente simples'),
    true
  );
  assert.equal(
    isValidNewAuthenticationPassword(
      'A'.repeat(authenticationPasswordMinimumLength)
    ),
    true
  );
});

void test('política rejeita tamanho, controle e representação não canônica', () => {
  assert.equal(
    isValidNewAuthenticationPassword(
      'A'.repeat(authenticationPasswordMinimumLength - 1)
    ),
    false
  );
  assert.equal(
    isValidNewAuthenticationPassword(
      'A'.repeat(authenticationPasswordMaximumLength + 1)
    ),
    false
  );
  assert.equal(
    isValidNewAuthenticationPassword('Senha\u0000segura com tamanho'),
    false
  );
  assert.equal(
    isValidNewAuthenticationPassword('Senha Á segura e longa'),
    false
  );
  assert.equal(
    isValidNewAuthenticationPassword(
      ' '.repeat(authenticationPasswordMinimumLength)
    ),
    false
  );
});

void test('limite defensivo usa pontos de código completos', () => {
  assert.equal(
    isAuthenticationPasswordWithinMaximumLength(
      '\u{1F6E1}'.repeat(authenticationPasswordMaximumLength)
    ),
    true
  );
  assert.equal(
    isAuthenticationPasswordWithinMaximumLength(
      '\u{1F6E1}'.repeat(authenticationPasswordMaximumLength + 1)
    ),
    false
  );
});

void test('candidato de e-mail respeita forma normalizada e limite persistente', () => {
  assert.equal(isAuthenticationEmailLookupCandidate('user@example.test'), true);
  assert.equal(isAuthenticationEmailLookupCandidate(''), false);
  assert.equal(isAuthenticationEmailLookupCandidate('invalid'), false);
  assert.equal(isAuthenticationEmailLookupCandidate('a@@example.test'), false);
  assert.equal(
    isAuthenticationEmailLookupCandidate('user @example.test'),
    false
  );
  assert.equal(
    isAuthenticationEmailLookupCandidate(
      `${'a'.repeat(authenticationEmailMaximumLength)}@example.test`
    ),
    false
  );
});
