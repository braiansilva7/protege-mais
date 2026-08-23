import type { LanguageCode } from '@/types/user';

export function localeFromLanguage(
  languageCode: LanguageCode
): 'pt' | 'en' | 'es' {
  return languageCode === 'pt-BR' ? 'pt' : languageCode;
}
