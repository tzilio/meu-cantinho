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
 * - check_in_date / check_out_date
 * - start_time / end_time
 * - adults_count (<= capacity do espaço)
 * - prevenção de períodos conflitantes para o mesmo espaço
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
      adults_count,
      deposit_pct,
      notes,
    } = req.body as {
      customer_id?: string;
      check_in_date?: string;
      check_out_date?: string;
      start_time?: string;
      end_time?: string;
      adults_count?: number;
      deposit_pct?: number;
      notes?: string;
    };

    // validação básica
    if (!customer_id) {
      return res.status(400).json({ error: 'invalid_customer_id' });
    }
    if (!check_in_date) {
      return res.status(400).json({ error: 'invalid_check_in_date' });
    }
    if (!check_out_date) {
      return res.status(400).json({ error: 'invalid_check_out_date' });
    }
    if (!start_time) {
      return res.status(400).json({ error: 'invalid_start_time' });
    }
    if (!end_time) {
      return res.status(400).json({ error: 'invalid_end_time' });
    }
    if (adults_count == null || Number(adults_count) <= 0) {
      return res.status(400).json({ error: 'invalid_adults_count' });
    }

    // check-out não pode ser antes do check-in
    if (check_out_date < check_in_date) {
      return res.status(400).json({ error: 'checkout_before_checkin' });
    }

    // busca espaço (com capacity)
    const spaceCheck = await pool.query(
      'SELECT id, branch_id, price_per_hour, capacity FROM spaces WHERE id = $1 AND active = TRUE',
      [spaceId],
    );

    if (spaceCheck.rowCount === 0) {
      return res.status(404).json({ error: 'space_not_found_or_inactive' });
    }

    const { branch_id, price_per_hour, capacity } = spaceCheck.rows[0];

    // valida capacidade (adultos não podem exceder capacity)
    if (Number(adults_count) > Number(capacity)) {
      return res.status(400).json({
        error: 'capacity_exceeded',
        details: {
          capacity: Number(capacity),
          adults_count: Number(adults_count),
        },
      });
    }

    // cálculo da duração em horas (para total_amount)
    const start = new Date(`${check_in_date}T${start_time}`);
    const end = new Date(`${check_out_date}T${end_time}`);

    if (end <= start) {
      return res.status(400).json({ error: 'invalid_time_range' });
    }

    const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const total_amount = Number(diffHours * Number(price_per_hour));

    // ===== checagem de conflito de reserva para o mesmo espaço =====
    //
    // Consideramos o intervalo [start_ts, end_ts) para a nova reserva
    // e para as reservas existentes.
    // Duas reservas conflitam se:
    //    existing_start < new_end AND new_start < existing_end
    //
    const conflictSql = `
      SELECT 1
      FROM reservations
      WHERE space_id = $1
        AND status <> 'CANCELLED'
        AND (
          (check_in_date + start_time) < ($3::date + $5::time)
          AND ($2::date + $4::time) < (check_out_date + end_time)
        )
      LIMIT 1;
    `;

    const conflictParams: SqlParam[] = [
      spaceId,         // $1
      check_in_date,   // $2
      check_out_date,  // $3
      start_time,      // $4
      end_time,        // $5
    ];

    const conflictCheck = await pool.query(conflictSql, conflictParams);
    if (conflictCheck.rowCount > 0) {
      return res.status(409).json({ error: 'conflicting_reservation' });
    }

    // Se chegou aqui, pode criar
    const reservationId = uuid();

    const sql = `
      INSERT INTO reservations
        (id, space_id, branch_id, customer_id,
         check_in_date, check_out_date,
         start_time, end_time,
         adults_count,
         status, total_amount, deposit_pct, notes)
      VALUES
        ($1, $2, $3, $4,
         $5, $6,
         $7, $8,
         $9,
         'PENDING', $10, COALESCE($11, 0), $12)
      RETURNING *;
    `;

    const params: SqlParam[] = [
      reservationId,
      spaceId,
      branch_id,
      customer_id,
      check_in_date,
      check_out_date,
      start_time,
      end_time,
      Number(adults_count),
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
 * - date (match se a data está entre check_in_date e check_out_date)
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
