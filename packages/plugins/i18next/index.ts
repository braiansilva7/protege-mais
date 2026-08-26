import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createInstance, type TFunction } from 'i18next';
import Backend from 'i18next-fs-backend';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const supportedLocales = ['pt-BR', 'en', 'es'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

export const defaultLocale: SupportedLocale = 'pt-BR';

declare module 'fastify' {
  interface FastifyRequest {
    locale: SupportedLocale;
    t: TFunction;
  }
}

interface LanguagePreference {
  readonly index: number;
  readonly locale: SupportedLocale | undefined;
  readonly quality: number;
  readonly wildcard: boolean;
}

const dirname = path.dirname(fileURLToPath(import.meta.url));

function normalizeLanguageTag(languageTag: string) {
  const primaryLanguage = languageTag
    .trim()
    .replaceAll('_', '-')
    .split('-', 1)[0]
    ?.toLowerCase();

  switch (primaryLanguage) {
    case 'pt':
      return 'pt-BR';
    case 'en':
      return 'en';
    case 'es':
      return 'es';
    default:
      return undefined;
  }
}

function parseQuality(parameters: readonly string[]) {
  const qualityParameter = parameters.find((parameter) => {
    const [name] = parameter.split('=', 1);
    return name?.trim().toLowerCase() === 'q';
  });

  if (qualityParameter === undefined) {
    return 1;
  }

  const separatorIndex = qualityParameter.indexOf('=');
  const quality = Number(qualityParameter.slice(separatorIndex + 1).trim());

  return Number.isFinite(quality) && quality >= 0 && quality <= 1 ? quality : 0;
}

function parseLanguagePreference(
  value: string,
  index: number
): LanguagePreference | undefined {
  const [languageRange, ...parameters] = value.split(';');
  const normalizedRange = languageRange?.trim();

  if (normalizedRange === undefined || normalizedRange === '') {
    return undefined;
  }

  return {
    index,
    locale: normalizeLanguageTag(normalizedRange),
    quality: parseQuality(parameters),
    wildcard: normalizedRange === '*',
  };
}

export function resolveLocale(
  acceptLanguage: string | readonly string[] | undefined
): SupportedLocale {
  if (acceptLanguage === undefined) {
    return defaultLocale;
  }

  const header =
    typeof acceptLanguage === 'string'
      ? acceptLanguage
      : acceptLanguage.join(',');

  const preferences = header
    .split(',')
    .map(parseLanguagePreference)
    .filter(
      (preference): preference is LanguagePreference =>
        preference !== undefined && preference.quality > 0
    )
    .sort(
      (left, right) => right.quality - left.quality || left.index - right.index
    );

  for (const preference of preferences) {
    if (preference.locale !== undefined) {
      return preference.locale;
    }

    if (preference.wildcard) {
      return defaultLocale;
    }
  }

  return defaultLocale;
}

function appendAcceptLanguageToVary(fastify: FastifyInstance) {
  fastify.addHook('onSend', (_request, reply, _payload, done) => {
    const currentVary = reply.getHeader('Vary');
    const varyValues = Array.isArray(currentVary)
      ? currentVary.join(',')
      : String(currentVary ?? '');
    const normalizedVaryValues = varyValues
      .split(',')
      .map((value) => value.trim().toLowerCase());

    if (
      !normalizedVaryValues.includes('*') &&
      !normalizedVaryValues.includes('accept-language')
    ) {
      reply.header(
        'Vary',
        varyValues === '' ? 'Accept-Language' : `${varyValues}, Accept-Language`
      );
    }

    done();
  });
}

async function i18nextPlugin(fastify: FastifyInstance) {
  const i18next = createInstance();

  await i18next.use(Backend).init({
    backend: {
      loadPath: path.join(dirname, 'locales', '{{lng}}', 'translation.json'),
    },
    fallbackLng: defaultLocale,
    interpolation: { escapeValue: false },
    load: 'currentOnly',
    preload: supportedLocales,
    returnEmptyString: false,
    returnNull: false,
    returnObjects: false,
    supportedLngs: supportedLocales,
  });

  if (!fastify.hasRequestDecorator('locale')) {
    fastify.decorateRequest('locale', defaultLocale);
  }

  if (!fastify.hasRequestDecorator('t')) {
    fastify.decorateRequest('t');
  }

  fastify.addHook('onRequest', (request, reply, done) => {
    const locale = resolveLocale(request.headers['accept-language']);

    request.locale = locale;
    request.t = i18next.getFixedT(locale);
    reply.header('Content-Language', locale);
    done();
  });

  appendAcceptLanguageToVary(fastify);
}

export const registerI18next = fp(i18nextPlugin, { name: 'i18next' });

export default registerI18next;
