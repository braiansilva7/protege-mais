import { createI18n } from 'vue-i18n';

const messages = Object.fromEntries(
  Object.entries(
    import.meta.glob<{ default: Record<string, string> }>('./locales/*.json', {
      eager: true,
    })
  ).map(([path, module]) => [
    path.slice(path.lastIndexOf('/') + 1, -5),
    module.default,
  ])
);

function browserLocale(): 'pt' | 'en' | 'es' {
  const language = navigator.language.toLowerCase();
  if (language.startsWith('en')) return 'en';
  if (language.startsWith('es')) return 'es';
  return 'pt';
}

export const i18n = createI18n({
  legacy: false,
  locale: browserLocale(),
  fallbackLocale: 'pt',
  messages,
  warnHtmlMessage: false,
});
