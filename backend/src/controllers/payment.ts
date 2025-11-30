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
 * @openapi
 * components:
 *   schemas:
 *     Payment:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         reservation_id:
 *           type: string
 *           format: uuid
 *         amount:
 *           type: number
 *           format: float
 *         method:
 *           type: string
 *           enum: [PIX, CARD, CASH, BOLETO]
 *         status:
 *           type: string
 *           enum: [PENDING, PAID, CANCELLED, REFUNDED]
 *         purpose:
 *           type: string
 *           enum: [DEPOSIT, BALANCE]
 *         external_ref:
 *           type: string
 *           nullable: true
 *         paid_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 */

/**
 * @openapi
 * /reservations/{reservationId}/payments:
 *   post:
 *     summary: Registra um pagamento para uma reserva
 *     description: "Cria um pagamento vinculado à reserva, iniciando com status PENDING."
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: reservationId
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
 *             required: [amount, method]
 *             properties:
 *               amount:
 *                 type: number
 *                 format: float
 *                 example: 500.0
 *               method:
 *                 type: string
 *                 example: "PIX"
 *               purpose:
 *                 type: string
 *                 enum: [DEPOSIT, BALANCE]
 *                 example: "DEPOSIT"
 *               external_ref:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201:
 *         description: "Pagamento criado."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Payment"
 *       400:
 *         description: "Dados inválidos."
 *       404:
 *         description: "Reserva não encontrada."
 */
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

    // Verifica se a reserva existe
    const reservationCheck = await pool.query(
      'SELECT id FROM reservations WHERE id = $1',
      [reservationId],
    );
    if (reservationCheck.rowCount === 0) {
      return res.status(404).json({ error: 'reservation_not_found' });
    }

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
        amount::float8   AS amount,
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

/**
 * @openapi
 * /payments/{paymentId}:
 *   get:
 *     summary: Detalhes de um pagamento
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: "Pagamento encontrado."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Payment"
 *       404:
 *         description: "Pagamento não encontrado."
 */
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

/**
 * @openapi
 * /payments/{paymentId}/confirm:
 *   post:
 *     summary: Confirma um pagamento
 *     description: "Altera o status para PAID e registra data/hora do pagamento."
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               external_ref:
 *                 type: string
 *                 nullable: true
 *               paid_at:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *     responses:
 *       200:
 *         description: "Pagamento confirmado."
 *       404:
 *         description: "Pagamento não encontrado."
 */
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
      SET status      = 'PAID',
          paid_at     = COALESCE($2::timestamptz, NOW()),
          external_ref= COALESCE($3, external_ref)
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
    const params: SqlParam[] = [paymentId, paid_at ?? null, external_ref ?? null];
    const { rows } = await pool.query<PaymentRow>(sql, params);

    return res.json(rows[0]);
  } catch (err) {
    return sendInternalError(res, err, 'confirmPayment');
  }
};

/**
 * @openapi
 * /payments/{paymentId}:
 *   delete:
 *     summary: Remove um pagamento (apenas se não estiver PAID)
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: "Pagamento removido."
 *       400:
 *         description: "Regra de negócio impede a exclusão."
 *       404:
 *         description: "Pagamento não encontrado."
 */
export const removePayment = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;

    const lookup = await pool.query(
      'SELECT status FROM payments WHERE id = $1',
      [paymentId],
    );

    if (!lookup.rows[0]) {
      return res.status(404).json({ error: 'payment_not_found' });
    }
    if (lookup.rows[0].status === 'PAID') {
      return res.status(400).json({ error: 'cannot_delete_paid_payment' });
    }

    await pool.query('DELETE FROM payments WHERE id = $1', [paymentId]);
    return res.status(204).send();
  } catch (err) {
    return sendInternalError(res, err, 'removePayment');
  }
};

/**
 * @openapi
 * /payments:
 *   get:
 *     summary: Lista pagamentos com filtros opcionais
 *     tags: [Payments]
 *     parameters:
 *       - in: query
 *         name: branch_id
 *         schema:
 *           type: string
 *           format: uuid
 *         required: false
 *         description: Filtra pela filial (branch) da reserva.
 *       - in: query
 *         name: space_id
 *         schema:
 *           type: string
 *           format: uuid
 *         required: false
 *         description: Filtra pelo espaço da reserva.
 *       - in: query
 *         name: customer_id
 *         schema:
 *           type: string
 *           format: uuid
 *         required: false
 *         description: Filtra pelo cliente (usuário com role CUSTOMER).
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         required: false
 *         description: Filtra status do pagamento (PENDING, PAID, ...).
 *       - in: query
 *         name: method
 *         schema:
 *           type: string
 *         required: false
 *         description: Filtra método de pagamento (PIX, CARD, CASH, BOLETO).
 *       - in: query
 *         name: purpose
 *         schema:
 *           type: string
 *         required: false
 *         description: Filtra tipo do pagamento (DEPOSIT, BALANCE).
 *       - in: query
 *         name: from_date
 *         schema:
 *           type: string
 *           format: date
 *         required: false
 *         description: Data mínima da reserva (YYYY-MM-DD).
 *       - in: query
 *         name: to_date
 *         schema:
 *           type: string
 *           format: date
 *         required: false
 *         description: Data máxima da reserva (YYYY-MM-DD).
 *     responses:
 *       200:
 *         description: Lista de pagamentos com informações agregadas da reserva, cliente, espaço e filial.
 */
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

        r.date,
        r.start_time,
        r.end_time,
        r.status AS reservation_status,
        r.total_amount,
        r.deposit_pct,
        r.customer_id,

        s.id   AS space_id,
        s.name AS space_name,

        b.id   AS branch_id,
        b.name AS branch_name,

        u.name  AS customer_name,
        u.email AS customer_email,
        u.phone AS customer_phone
      FROM payments p
      JOIN reservations r ON r.id = p.reservation_id
      JOIN spaces       s ON s.id = r.space_id
      JOIN branches     b ON b.id = r.branch_id
      JOIN customers        u ON u.id = r.customer_id
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
      conditions.push(`r.date >= $${idx++}::date`);
      params.push(from_date);
    }
    if (to_date) {
      conditions.push(`r.date <= $${idx++}::date`);
      params.push(to_date);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY p.created_at DESC, p.id DESC';

    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    return sendInternalError(res, err, 'listPayments');
  }
};

export {};
