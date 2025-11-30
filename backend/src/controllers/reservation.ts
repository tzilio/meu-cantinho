// src/controllers/reservation.ts
import { Request, Response } from 'express';
import { pool } from '../db';
import { v4 as uuid } from 'uuid';

type SqlParam = string | number | boolean | null;

function sendInternalError(res: Response, err: unknown, context: string) {
  console.error(`[reservations:${context}]`, err);
  return res.status(500).json({ error: 'internal_error', context });
}

/**
 * @openapi
 * components:
 *   schemas:
 *     Reservation:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         space_id:
 *           type: string
 *           format: uuid
 *         branch_id:
 *           type: string
 *           format: uuid
 *         customer_id:
 *           type: string
 *           format: uuid
 *         date:
 *           type: string
 *           format: date
 *         start_time:
 *           type: string
 *           format: time
 *         end_time:
 *           type: string
 *           format: time
 *         status:
 *           type: string
 *           enum: [PENDING, CONFIRMED, CANCELLED]
 *         total_amount:
 *           type: number
 *           format: float
 *         deposit_pct:
 *           type: number
 *           format: float
 *         notes:
 *           type: string
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

/**
 * @openapi
 * /spaces/{spaceId}/reservations:
 *   post:
 *     summary: Cria uma reserva para um espaço
 *     tags: [Reservations]
 *     parameters:
 *       - in: path
 *         name: spaceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customer_id, date, start_time, end_time, total_amount]
 *             properties:
 *               customer_id:
 *                 type: string
 *                 format: uuid
 *               date:
 *                 type: string
 *                 format: date
 *               start_time:
 *                 type: string
 *                 format: time
 *               end_time:
 *                 type: string
 *                 format: time
 *               total_amount:
 *                 type: number
 *                 format: float
 *                 example: 800.0
 *               deposit_pct:
 *                 type: number
 *                 format: float
 *                 example: 50.0
 *               notes:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Reserva criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Reservation"
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Espaço ou cliente não encontrado
 */
export const createReservation = async (req: Request, res: Response) => {
  try {
    const { spaceId } = req.params;
    const {
      customer_id,
      date,
      start_time,
      end_time,
      total_amount,
      deposit_pct,
      notes,
    } = req.body as {
      customer_id?: string;
      date?: string;
      start_time?: string;
      end_time?: string;
      total_amount?: number;
      deposit_pct?: number;
      notes?: string | null;
    };

    if (!customer_id || typeof customer_id !== 'string') {
      return res.status(400).json({ error: 'invalid_customer_id' });
    }
    if (!date || typeof date !== 'string') {
      return res.status(400).json({ error: 'invalid_date' });
    }
    if (!start_time || typeof start_time !== 'string') {
      return res.status(400).json({ error: 'invalid_start_time' });
    }
    if (!end_time || typeof end_time !== 'string') {
      return res.status(400).json({ error: 'invalid_end_time' });
    }
    if (total_amount == null || isNaN(Number(total_amount)) || Number(total_amount) < 0) {
      return res.status(400).json({ error: 'invalid_total_amount' });
    }
    if (
      deposit_pct != null &&
      (isNaN(Number(deposit_pct)) ||
        Number(deposit_pct) < 0 ||
        Number(deposit_pct) > 100)
    ) {
      return res.status(400).json({ error: 'invalid_deposit_pct' });
    }

    // Confere espaço
    const spaceCheck = await pool.query(
      'SELECT id, branch_id FROM spaces WHERE id = $1 AND active = TRUE',
      [spaceId],
    );
    if (spaceCheck.rowCount === 0) {
      return res.status(404).json({ error: 'space_not_found_or_inactive' });
    }
    const branchId = spaceCheck.rows[0].branch_id as string;

    // Confere cliente
    const customerCheck = await pool.query(
      'SELECT id FROM customers WHERE id = $1',
      [customer_id],
    );
    if (customerCheck.rowCount === 0) {
      return res.status(404).json({ error: 'customer_not_found' });
    }

    const reservationId = uuid();

    const sql = `
      INSERT INTO reservations
        (id, space_id, branch_id, customer_id,
         date, start_time, end_time,
         status, total_amount, deposit_pct, notes)
      VALUES
        ($1, $2, $3, $4,
         $5, $6, $7,
         'PENDING', $8, COALESCE($9, 0), $10)
      RETURNING *;
    `;

    const params: SqlParam[] = [
      reservationId,
      spaceId,
      branchId,
      customer_id,
      date,
      start_time,
      end_time,
      Number(total_amount),
      deposit_pct != null ? Number(deposit_pct) : null,
      notes ?? null,
    ];

    const { rows } = await pool.query(sql, params);
    return res.status(201).json(rows[0]);
  } catch (err) {
    return sendInternalError(res, err, 'createReservation');
  }
};

/**
 * @openapi
 * /reservations/{reservationId}:
 *   get:
 *     summary: Detalhes de uma reserva
 *     tags: [Reservations]
 *     parameters:
 *       - in: path
 *         name: reservationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Reserva encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Reservation"
 *       404:
 *         description: Reserva não encontrada
 */
export const fetchReservation = async (req: Request, res: Response) => {
  try {
    const { reservationId } = req.params;
    const { rows } = await pool.query(
      'SELECT * FROM reservations WHERE id = $1',
      [reservationId],
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'reservation_not_found' });
    }

    return res.json(rows[0]);
  } catch (err) {
    return sendInternalError(res, err, 'fetchReservation');
  }
};

/**
 * @openapi
 * /spaces/{spaceId}/reservations:
 *   get:
 *     summary: Lista reservas de um espaço (opcionalmente por data)
 *     tags: [Reservations]
 *     parameters:
 *       - in: path
 *         name: spaceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: date
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: "Se informado, filtra reservas por essa data."
 *     responses:
 *       200:
 *         description: Lista de reservas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/Reservation"
 *       404:
 *         description: Espaço não encontrado
 */
export const listReservationsBySpace = async (req: Request, res: Response) => {
  try {
    const { spaceId } = req.params;
    const { date } = req.query as { date?: string };

    const spaceCheck = await pool.query(
      'SELECT id FROM spaces WHERE id = $1',
      [spaceId],
    );
    if (spaceCheck.rowCount === 0) {
      return res.status(404).json({ error: 'space_not_found' });
    }

    let sql = 'SELECT * FROM reservations WHERE space_id = $1';
    const params: SqlParam[] = [spaceId];

    if (date) {
      sql += ' AND date = $2';
      params.push(date);
    }

    sql += ' ORDER BY date ASC, start_time ASC';

    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    return sendInternalError(res, err, 'listReservationsBySpace');
  }
};

/**
 * @openapi
 * /reservations/{reservationId}/cancel:
 *   patch:
 *     summary: Cancela uma reserva
 *     tags: [Reservations]
 *     parameters:
 *       - in: path
 *         name: reservationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Reserva cancelada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Reservation"
 *       404:
 *         description: Reserva não encontrada
 */
export const cancelReservation = async (req: Request, res: Response) => {
  try {
    const { reservationId } = req.params;

    const existing = await pool.query(
      'SELECT status FROM reservations WHERE id = $1',
      [reservationId],
    );
    if (!existing.rows[0]) {
      return res.status(404).json({ error: 'reservation_not_found' });
    }

    const sql = `
      UPDATE reservations
      SET status = 'CANCELLED',
          updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await pool.query(sql, [reservationId]);
    return res.json(rows[0]);
  } catch (err) {
    return sendInternalError(res, err, 'cancelReservation');
  }
};

export {};
