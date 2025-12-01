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
 * ============================
 * CREATE RESERVATION
 * ============================
 * Agora usando:
 * - check_in_date
 * - check_out_date
 * - start_time
 * - end_time
 * E calculando total_amount automaticamente
 */
export const createReservation = async (req: Request, res: Response) => {
  try {
    const { spaceId } = req.params;

    const {
      customer_id,
      check_in_date,
      check_out_date,
      start_time,
      end_time,
      deposit_pct,
      notes,
    } = req.body;

    // validação básica
    if (!customer_id) return res.status(400).json({ error: 'invalid_customer_id' });
    if (!check_in_date) return res.status(400).json({ error: 'invalid_check_in_date' });
    if (!check_out_date) return res.status(400).json({ error: 'invalid_check_out_date' });
    if (!start_time) return res.status(400).json({ error: 'invalid_start_time' });
    if (!end_time) return res.status(400).json({ error: 'invalid_end_time' });

    // check-out não pode ser antes do check-in
    if (check_out_date < check_in_date) {
      return res.status(400).json({ error: 'checkout_before_checkin' });
    }

    // busca espaço
    const spaceCheck = await pool.query(
      'SELECT id, branch_id, price_per_hour FROM spaces WHERE id = $1 AND active = TRUE',
      [spaceId]
    );

    if (spaceCheck.rowCount === 0) {
      return res.status(404).json({ error: 'space_not_found_or_inactive' });
    }

    const { branch_id, price_per_hour } = spaceCheck.rows[0];

    // cálculo da duração
    const start = new Date(`${check_in_date}T${start_time}`);
    const end   = new Date(`${check_out_date}T${end_time}`);

    if (end <= start) {
      return res.status(400).json({ error: 'invalid_time_range' });
    }

    const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const total_amount = Number(diffHours * Number(price_per_hour));

    const reservationId = uuid();

    const sql = `
      INSERT INTO reservations
        (id, space_id, branch_id, customer_id,
         check_in_date, check_out_date,
         start_time, end_time,
         status, total_amount, deposit_pct, notes)
      VALUES
        ($1, $2, $3, $4,
         $5, $6,
         $7, $8,
         'PENDING', $9, COALESCE($10, 0), $11)
      RETURNING *;
    `;

    const params = [
      reservationId,
      spaceId,
      branch_id,
      customer_id,
      check_in_date,
      check_out_date,
      start_time,
      end_time,
      total_amount,
      deposit_pct ?? null,
      notes ?? null,
    ];

    const { rows } = await pool.query(sql, params);
    return res.status(201).json(rows[0]);

  } catch (err) {
    return sendInternalError(res, err, 'createReservation');
  }
};


/**
 * ============================
 * GET RESERVATION BY ID
 * ============================
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
 * ============================
 * LIST RESERVATIONS BY SPACE
 * ============================
 * Filtro opcional:
 * - date (match se a data está entre check_in e check_out)
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

    let sql = `
      SELECT *
      FROM reservations
      WHERE space_id = $1
    `;

    const params: SqlParam[] = [spaceId];

    if (date) {
      sql += `
        AND $2::date BETWEEN check_in_date AND check_out_date
      `;
      params.push(date);
    }

    sql += `
      ORDER BY check_in_date ASC, start_time ASC
    `;

    const { rows } = await pool.query(sql, params);
    return res.json(rows);

  } catch (err) {
    return sendInternalError(res, err, 'listReservationsBySpace');
  }
};


/**
 * ============================
 * CANCEL RESERVATION
 * ============================
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
