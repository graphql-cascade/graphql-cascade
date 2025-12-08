import { createApp } from 'vue';
import urql from '@urql/vue';
import App from './App.vue';
import { client } from './urql-client';

const app = createApp(App);

app.use(urql, client);

app.mount('#app');
