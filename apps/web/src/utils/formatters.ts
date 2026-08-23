export function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'pt' ? 'pt-BR' : locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
