// src/controllers/payment.ts
import { Request, Response } from 'express';
import { pool } from '../db';
import { v4 as uuid } from 'uuid';

type SqlParam = string | number | null;

function sendInternalError(res: Response, err: unknown, context: string) {
  console.error(`[payments:${context}]`, err);
  return res.status(500).json({ error: 'internal_error', context });
}

type PaymentRow = {
  id: string;
  reservation_id: string;
  amount: number;
  method: string;
  status: string;
  purpose: string;
  paid_at: string | null;
  external_ref: string | null;
  created_at: string | null;
};

/**
 * Helper: recalcula status da reserva com base nos pagamentos PAID.
 * - Se soma(PAID) >= total_amount -> status = 'CONFIRMED'
 * - Senão mantém como está (normalmente 'PENDING')
 */
async function recomputeReservationStatus(reservationId: string) {
  const sql = `
    SELECT
      r.id,
      r.total_amount::float8 AS total_amount,
      COALESCE(SUM(
        CASE WHEN p.status = 'PAID' THEN p.amount ELSE 0 END
      ), 0)::float8 AS paid_sum
    FROM reservations r
    LEFT JOIN payments p ON p.reservation_id = r.id
    WHERE r.id = $1
    GROUP BY r.id, r.total_amount
  `;
  const { rows } = await pool.query(sql, [reservationId]);

  if (!rows[0]) {
    return; // reserva não encontrada (não deve acontecer aqui)
  }

  const totalAmount = Number(rows[0].total_amount);
  const paidSum = Number(rows[0].paid_sum);

  if (paidSum >= totalAmount && totalAmount > 0) {
    await pool.query(
      `
        UPDATE reservations
        SET status = 'CONFIRMED',
            updated_at = NOW()
        WHERE id = $1
      `,
      [reservationId],
    );
  }
}

/* ===========================================================
   POST /reservations/:reservationId/payments
   Criar pagamento (parcial ou total)
   =========================================================== */
export const registerPayment = async (req: Request, res: Response) => {
  try {
    const { reservationId } = req.params;
    const {
      amount,
      method,
      purpose,
      external_ref,
    } = req.body as {
      amount?: number;
      method?: string;
      purpose?: string;
      external_ref?: string | null;
    };

    if (amount == null || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'invalid_amount' });
    }
    if (!method || typeof method !== 'string') {
      return res.status(400).json({ error: 'invalid_method' });
    }

    // 1) Verifica se a reserva existe e pega o total
    const reservationCheck = await pool.query(
      'SELECT id, total_amount::float8 AS total_amount FROM reservations WHERE id = $1',
      [reservationId],
    );
    if (reservationCheck.rowCount === 0) {
      return res.status(404).json({ error: 'reservation_not_found' });
    }

    const totalAmount = Number(reservationCheck.rows[0].total_amount);

    // 2) Soma pagamentos já existentes (PENDING + PAID) para não ultrapassar o total
    const sumRes = await pool.query(
      `
        SELECT COALESCE(SUM(amount), 0)::float8 AS committed
        FROM payments
        WHERE reservation_id = $1
          AND status IN ('PENDING', 'PAID')
      `,
      [reservationId],
    );
    const alreadyCommitted = Number(sumRes.rows[0].committed);
    const remaining = totalAmount - alreadyCommitted;

    if (Number(amount) > remaining + 0.0001) {
      // pequeno delta por segurança de arredondamento
      return res.status(400).json({
        error: 'amount_exceeds_remaining',
        message: 'Valor do pagamento excede o saldo restante da reserva.',
        remaining,
      });
    }

    // 3) Cria o pagamento (PENDING)
    const id = uuid();
    const finalPurpose = purpose && purpose.trim() ? purpose.trim() : 'DEPOSIT';

    const sql = `
      INSERT INTO payments
        (id, reservation_id, amount, method, status, purpose, external_ref)
      VALUES
        ($1, $2, $3, $4, 'PENDING', $5, $6)
      RETURNING
        id,
        reservation_id,
        amount::float8 AS amount,
        method,
        status,
        purpose,
        external_ref,
        paid_at,
        created_at
    `;

    const params: SqlParam[] = [
      id,
      reservationId,
      Number(amount),
      method,
      finalPurpose,
      external_ref ?? null,
    ];

    const { rows } = await pool.query<PaymentRow>(sql, params);
    return res.status(201).json(rows[0]);
  } catch (err) {
    return sendInternalError(res, err, 'registerPayment');
  }
};

/* ===========================================================
   GET /payments/:paymentId
   =========================================================== */
export const fetchPayment = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;

    const sql = `
      SELECT
        id,
        reservation_id,
        amount::float8 AS amount,
        method,
        status,
        purpose,
        external_ref,
        paid_at,
        created_at
      FROM payments
      WHERE id = $1
    `;
    const { rows } = await pool.query<PaymentRow>(sql, [paymentId]);

    if (!rows[0]) {
      return res.status(404).json({ error: 'payment_not_found' });
    }

    return res.json(rows[0]);
  } catch (err) {
    return sendInternalError(res, err, 'fetchPayment');
  }
};

/* ===========================================================
   POST /payments/:paymentId/confirm
   Confirma pagamento & atualiza status da reserva se quitada
   =========================================================== */
export const confirmPayment = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const { external_ref, paid_at } = req.body as {
      external_ref?: string | null;
      paid_at?: string | null;
    };

    const exists = await pool.query(
      'SELECT status FROM payments WHERE id = $1',
      [paymentId],
    );
    if (!exists.rows[0]) {
      return res.status(404).json({ error: 'payment_not_found' });
    }

    const sql = `
      UPDATE payments
      SET status       = 'PAID',
          paid_at      = COALESCE($2::timestamptz, NOW()),
          external_ref = COALESCE($3, external_ref)
      WHERE id = $1
      RETURNING
        id,
        reservation_id,
        amount::float8 AS amount,
        method,
        status,
        purpose,
        external_ref,
        paid_at,
        created_at
    `;
    const params: SqlParam[] = [
      paymentId,
      paid_at ?? null,
      external_ref ?? null,
    ];

    const { rows } = await pool.query<PaymentRow>(sql, params);
    const payment = rows[0];

    // Recalcula status da reserva após confirmar este pagamento
    await recomputeReservationStatus(payment.reservation_id);

    return res.json(payment);
  } catch (err) {
    return sendInternalError(res, err, 'confirmPayment');
  }
};

/* ===========================================================
   DELETE /payments/:paymentId
   Só permite deletar se NÃO estiver PAID
   =========================================================== */
export const removePayment = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;

    const lookup = await pool.query(
      'SELECT status, reservation_id FROM payments WHERE id = $1',
      [paymentId],
    );

    if (!lookup.rows[0]) {
      return res.status(404).json({ error: 'payment_not_found' });
    }
    if (lookup.rows[0].status === 'PAID') {
      return res.status(400).json({ error: 'cannot_delete_paid_payment' });
    }

    const reservationId: string = lookup.rows[0].reservation_id;

    await pool.query('DELETE FROM payments WHERE id = $1', [paymentId]);

    // Opcional: se você quiser, pode recalcular a reserva aqui também,
    // mas como não deletamos PAID, o status não muda.
    // await recomputeReservationStatus(reservationId);

    return res.status(204).send();
  } catch (err) {
    return sendInternalError(res, err, 'removePayment');
  }
};

/* ===========================================================
   GET /payments
   Usa check_in_date / check_out_date da reserva
   =========================================================== */
export const listPayments = async (req: Request, res: Response) => {
  try {
    const {
      branch_id,
      space_id,
      customer_id,
      status,
      method,
      purpose,
      from_date,
      to_date,
    } = req.query as {
      branch_id?: string;
      space_id?: string;
      customer_id?: string;
      status?: string;
      method?: string;
      purpose?: string;
      from_date?: string;
      to_date?: string;
    };

    let sql = `
      SELECT
        p.id,
        p.reservation_id,
        p.amount::float8 AS amount,
        p.method,
        p.status,
        p.purpose,
        p.external_ref,
        p.paid_at,
        p.created_at,

        r.check_in_date,
        r.check_out_date,
        r.start_time,
        r.end_time,
        r.status        AS reservation_status,
        r.total_amount,
        r.deposit_pct,
        r.customer_id,

        s.id            AS space_id,
        s.name          AS space_name,

        b.id            AS branch_id,
        b.name          AS branch_name,

        u.name          AS customer_name,
        u.email         AS customer_email,
        u.phone         AS customer_phone
      FROM payments p
      JOIN reservations r ON r.id = p.reservation_id
      JOIN spaces       s ON s.id = r.space_id
      JOIN branches     b ON b.id = r.branch_id
      JOIN customers    u ON u.id = r.customer_id
    `;

    const conditions: string[] = [];
    const params: SqlParam[] = [];
    let idx = 1;

    if (branch_id) {
      conditions.push(`b.id = $${idx++}`);
      params.push(branch_id);
    }
    if (space_id) {
      conditions.push(`s.id = $${idx++}`);
      params.push(space_id);
    }
    if (customer_id) {
      conditions.push(`u.id = $${idx++}`);
      params.push(customer_id);
    }
    if (status) {
      conditions.push(`p.status = $${idx++}`);
      params.push(status);
    }
    if (method) {
      conditions.push(`p.method = $${idx++}`);
      params.push(method);
    }
    if (purpose) {
      conditions.push(`p.purpose = $${idx++}`);
      params.push(purpose);
    }
    if (from_date) {
      conditions.push(`r.check_in_date >= $${idx++}::date`);
      params.push(from_date);
    }
    if (to_date) {
      conditions.push(`r.check_out_date <= $${idx++}::date`);
      params.push(to_date);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY p.created_at DESC, p.id DESC';

    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    return sendInternalError(res, err, 'listPayments');
  }
};

export {};
