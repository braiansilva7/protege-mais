import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeAccountEmail } from './index.js';

void test('normaliza e-mail de conta com trim e lowercase', () => {
  assert.equal(
    normalizeAccountEmail('  Person.Name+Tag@Example.COM  '),
    'person.name+tag@example.com'
  );
});

void test('normalização de e-mail é idempotente', () => {
  const normalized = normalizeAccountEmail('person@example.com');

  assert.equal(normalizeAccountEmail(normalized), normalized);
});
