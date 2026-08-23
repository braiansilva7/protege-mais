import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import { LanguageDetector, plugin } from 'i18next-http-middleware';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

async function i18nextPlugin(fastify: FastifyInstance) {
  await i18next
    .use(Backend)
    .use(LanguageDetector)
    .init({
      fallbackLng: 'pt',
      preload: ['pt', 'en', 'es'],
      backend: {
        loadPath: path.join(dirname, 'locales', '{{lng}}', 'translation.json'),
      },
      interpolation: { escapeValue: false },
      returnEmptyString: false,
      returnNull: false,
      returnObjects: false,
    });

  await fastify.register(plugin, { i18next });
}

export default fp(i18nextPlugin, { name: 'i18next' });
