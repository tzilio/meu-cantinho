import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import { aliases, md } from 'vuetify/iconsets/md';

const vuetify = createVuetify({
  icons: {
    defaultSet: 'md',
    aliases,
    sets: { md }
  },
  theme: {
    defaultTheme: 'light'
  }
});

const app = createApp(App);
app.use(router);
app.use(vuetify);
app.mount('#app');
