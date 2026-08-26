import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import {
  defaultLocale,
  registerI18next,
  resolveLocale,
  supportedLocales,
} from './index.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));

function flattenCatalog(
  value: Record<string, unknown>,
  prefix = ''
): readonly string[] {
  const keys: string[] = [];

  for (const [key, child] of Object.entries(value)) {
    const fullKey = prefix === '' ? key : `${prefix}.${key}`;

    if (typeof child === 'string') {
      assert.notEqual(
        child.trim(),
        '',
        `A chave ${fullKey} não pode ser vazia.`
      );
      keys.push(fullKey);
      continue;
    }

    assert.ok(
      child !== null && typeof child === 'object' && !Array.isArray(child),
      `A chave ${fullKey} deve conter texto ou um grupo de chaves.`
    );
    keys.push(...flattenCatalog(child as Record<string, unknown>, fullKey));
  }

  return keys.sort();
}

async function readCatalog(locale: string) {
  const catalogPath = path.join(dirname, 'locales', locale, 'translation.json');
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as unknown;

  assert.ok(
    catalog !== null && typeof catalog === 'object' && !Array.isArray(catalog),
    `O catálogo ${locale} deve ser um objeto JSON.`
  );

  return catalog as Record<string, unknown>;
}

void test('resolve locale padrão, variantes regionais e preferências ponderadas', () => {
  const scenarios = [
    [undefined, 'pt-BR'],
    ['', 'pt-BR'],
    ['fr-FR', 'pt-BR'],
    ['pt', 'pt-BR'],
    ['pt-PT', 'pt-BR'],
    ['en-US', 'en'],
    ['es-MX', 'es'],
    ['es-MX;q=0.6, en-GB;q=0.9', 'en'],
    ['en;q=0, es;q=0.5', 'es'],
    ['fr;q=1, en;q=0.8', 'en'],
    ['*', 'pt-BR'],
  ] as const;

  for (const [header, expectedLocale] of scenarios) {
    assert.equal(resolveLocale(header), expectedLocale);
  }
});

void test('mantém paridade e textos não vazios nos três catálogos', async () => {
  const referenceKeys = flattenCatalog(await readCatalog(defaultLocale));

  assert.ok(referenceKeys.includes('authentication.invalidCredentials'));
  assert.ok(referenceKeys.includes('errors.internalServer'));
  assert.ok(referenceKeys.includes('health.ok'));

  for (const locale of supportedLocales) {
    assert.deepEqual(
      flattenCatalog(await readCatalog(locale)),
      referenceKeys,
      `O catálogo ${locale} deve ter as mesmas chaves de ${defaultLocale}.`
    );
  }
});

void test('negocia tradução por HTTP e informa locale e variação de cache', async () => {
  const server = Fastify({ logger: false });
  await server.register(registerI18next);

  server.get('/translation', (request, reply) => {
    reply.header('Vary', 'Origin');
    return {
      locale: request.locale,
      message: request.t('health.ok'),
    };
  });

  const scenarios = [
    [undefined, 'pt-BR', 'Serviço operacional.'],
    ['en-US', 'en', 'Service is operational.'],
    ['es', 'es', 'El servicio está operativo.'],
    ['de-DE', 'pt-BR', 'Serviço operacional.'],
  ] as const;

  try {
    for (const [acceptLanguage, locale, message] of scenarios) {
      const response = await server.inject({
        method: 'GET',
        url: '/translation',
        headers:
          acceptLanguage === undefined
            ? undefined
            : { 'accept-language': acceptLanguage },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(JSON.parse(response.body), { locale, message });
      assert.equal(response.headers['content-language'], locale);
      assert.match(String(response.headers.vary), /(?:^|,\s*)Origin/i);
      assert.match(String(response.headers.vary), /(?:^|,\s*)Accept-Language/i);
    }
  } finally {
    await server.close();
  }
});
