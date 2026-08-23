import { createApp } from 'vue';
import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import '@/assets/styles/main.css';
import App from './App.vue';
import { i18n } from './plugins/i18n';

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'protegeMaisTheme',
    themes: {
      protegeMaisTheme: {
        dark: false,
        colors: {
          primary: '#7367f0',
          error: '#ea5455',
          success: '#28c76f',
        },
      },
    },
  },
});

createApp(App).use(vuetify).use(i18n).mount('#app');
