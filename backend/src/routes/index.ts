// src/routes/index.ts
import { Router } from 'express';

import {
  createUser,
  listUsers,
  fetchUser,
  updateUser,
  removeUser,
} from '../controllers/user';

import {
  createSpace,
  listSpacesByBranch,
  fetchSpace,
  updateSpace,
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
  settlePayment,
  removePayment,
} from '../controllers/payment';

const router = Router();

/**
 * USERS
 */
router.post('/users', createUser);
router.get('/users', listUsers);
router.get('/users/:userId', fetchUser);
router.patch('/users/:userId', updateUser);
router.delete('/users/:userId', removeUser);

/**
 * SPACES
 * espaços sempre associados a uma branch
 */
router.post('/branches/:branchId/spaces', createSpace);
router.get('/branches/:branchId/spaces', listSpacesByBranch);
router.get('/spaces/:spaceId', fetchSpace);
router.patch('/spaces/:spaceId', updateSpace);

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
 * pagamentos associados a uma reserva (bookingId no controller)
 */
router.post('/bookings/:bookingId/payments', registerPayment);
router.get('/payments/:paymentId', fetchPayment);
router.patch('/payments/:paymentId/settle', settlePayment);
router.delete('/payments/:paymentId', removePayment);

export default router;
