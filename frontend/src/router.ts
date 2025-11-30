import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';

import BranchesView from './views/BranchesView.vue';
import SpacesView from './views/SpacesView.vue';
import CustomersView from './views/CustomersView.vue';
import ReservationsView from './views/ReservationsView.vue';
import PaymentsView from './views/PaymentsView.vue';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/branches' },
  { path: '/branches', component: BranchesView },
  { path: '/spaces', component: SpacesView },
  { path: '/users', component: CustomersView },
  { path: '/reservations', component: ReservationsView },
  { path: '/payments', component: PaymentsView }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
