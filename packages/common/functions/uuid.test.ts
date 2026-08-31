import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createUuidV7, isUuidV7 } from './uuid.js';

void test('gera e reconhece somente UUID v7 válido', () => {
  const value = createUuidV7();

  assert.equal(isUuidV7(value), true);
  assert.equal(isUuidV7('550e8400-e29b-41d4-a716-446655440000'), false);
  assert.equal(isUuidV7('invalid-uuid'), false);
});
