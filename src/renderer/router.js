'use strict';
import { createRouter, createWebHashHistory } from 'vue-router';
import LoginView from './views/LoginView.vue';
import GameView from './views/GameView.vue';
import ParentView from './views/ParentView.vue';

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/login' },
    { path: '/login', component: LoginView },
    { path: '/game/:userId', component: GameView },
    { path: '/parent', component: ParentView },
  ],
});
