import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { runtimeEnvironment } from '@protege-mais/config/runtime';
import { createWebEnvironment } from '@protege-mais/config/validation';

export default defineConfig(() => {
  const configuration = createWebEnvironment(runtimeEnvironment());

  return {
    define: {
      __PROTEGE_MAIS_WEB_ENVIRONMENT__: JSON.stringify(configuration),
    },
    envDir: fileURLToPath(new URL('../..', import.meta.url)),
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  };
});
