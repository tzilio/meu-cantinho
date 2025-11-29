import { createRouter, createWebHistory } from 'vue-router'
import BranchesPage from '../views/BranchesPage.vue'
import BranchSpacesPage from '../views/BranchSpacesPage.vue'
import ReservationPaymentPage from '../views/ReservationPaymentPage.vue'

const routes = [
  { path: '/', redirect: '/branches' },
  { path: '/branches', name: 'branches', component: BranchesPage },
  {
    path: '/branches/:id/spaces',
    name: 'branch-spaces',
    component: BranchSpacesPage,
    props: true
  },
  {
    path: '/reservations',
    name: 'reservations',
    component: ReservationPaymentPage
  }
]

export const router = createRouter({
  history: createWebHistory(),
  routes
})
