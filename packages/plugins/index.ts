export { registerCors } from './cors.js';
export { registerDatabase, type AppDatabase } from './database/index.js';
export { registerErrorHandler } from './error-handler/index.js';
export {
  defaultLocale,
  registerI18next,
  registerI18next as i18nextPlugin,
  resolveLocale,
  supportedLocales,
  type SupportedLocale,
} from './i18next/index.js';
export { registerMultipart } from './multipart/index.js';
