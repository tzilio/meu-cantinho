// src/routes/index.ts
import { Router } from 'express';

import {
  registerBranch,
  searchBranches,
  getBranchById,
  patchBranch,
  removeBranch,
  listBranchSpaces,
} from '../controllers/branch';

import {
  createCustomer,
  listCustomers,
  fetchCustomer,
  updateCustomer,
  removeCustomer,
} from '../controllers/customer';

import {
  createSpace,
  listSpacesByBranch,
  fetchSpace,
  updateSpace,
  deleteSpace
} from '../controllers/space';

import {
  createReservation,
  fetchReservation,
  listReservationsBySpace,
  cancelReservation,
} from '../controllers/reservation';

import {
  registerPayment,
  fetchPayment,
  confirmPayment,
  removePayment,
  listPayments,
} from '../controllers/payment';

const router = Router();

/**
 * CUSTOMERS
 */
router.post('/customers', createCustomer);
router.get('/customers', listCustomers);
router.get('/customers/:customerId', fetchCustomer);
router.patch('/customers/:customerId', updateCustomer);
router.delete('/customers/:customerId', removeCustomer);

/**
 * SPACES
 * espaços sempre associados a uma branch
 */
router.post('/branches/:branchId/spaces', createSpace);
router.get('/branches/:branchId/spaces', listSpacesByBranch);
router.get('/spaces/:spaceId', fetchSpace);
router.patch('/spaces/:spaceId', updateSpace);
router.delete('/spaces/:spaceId', deleteSpace);

/**
 * RESERVATIONS
 * reservas associadas a um espaço (e, por tabela, a uma branch)
 */
router.post('/spaces/:spaceId/reservations', createReservation);
router.get('/spaces/:spaceId/reservations', listReservationsBySpace);
router.get('/reservations/:reservationId', fetchReservation);
router.patch('/reservations/:reservationId/cancel', cancelReservation);

/**
 * PAYMENTS
 * pagamentos associados a uma reserva
 */
router.get('/payments', listPayments);
router.post('/reservations/:reservationId/payments', registerPayment);
router.get('/payments/:paymentId', fetchPayment);
router.post('/payments/:paymentId/confirm', confirmPayment);
router.delete('/payments/:paymentId', removePayment);

router.post('/branches', registerBranch);
router.get('/branches', searchBranches);
router.get('/branches/:id', getBranchById);
router.patch('/branches/:id', patchBranch);
router.delete('/branches/:id', removeBranch);

export default router;
