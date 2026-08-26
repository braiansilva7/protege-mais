import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './packages/models/reference/drizzle',
  schema: './packages/models/reference/index.ts',
  dialect: 'postgresql',
});
