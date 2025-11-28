// src/controllers/payment.ts
import { Request, Response } from 'express';
import { pool } from 'db';
import { v4 as uuid } from 'uuid';

type SqlParam = string | number | null;


function sendInternalError(res: Response, err: unknown, context: string) {
  console.error(`[payments:${context}]`, err);
  return res.status(500).json({ error: 'internal_error', context });
}

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
 *         booking_id:
 *           type: string
 *           format: uuid
 *         gross_amount:
 *           type: number
 *           format: float
 *           description: "Valor bruto informado na cobrança."
 *         fee_amount:
 *           type: number
 *           format: float
 *           description: "Taxas de processamento ou tarifas bancárias."
 *         net_amount:
 *           type: number
 *           format: float
 *           description: "Valor líquido considerado para a reserva (bruto - taxa)."
 *         channel:
 *           type: string
 *           example: "PIX"
 *           description: "Canal de pagamento (PIX, CARTAO, DINHEIRO, etc.)."
 *         status:
 *           type: string
 *           enum: [PENDING, CLEARED]
 *           example: "PENDING"
 *         kind:
 *           type: string
 *           example: "DEPOSIT"
 *           description: "Tipo de pagamento: sinal, restante, valor integral, etc."
 *         provider_code:
 *           type: string
 *           nullable: true
 *           description: "Identificador do pagamento no provedor externo."
 *         cleared_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         updated_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 */

/**
 * @openapi
 * /bookings/{bookingId}/payments:
 *   post:
 *     summary: Registra um lançamento financeiro para uma reserva
 *     description: "Associa um novo pagamento (sinal, restante ou integral) a uma reserva existente, iniciando com status PENDING."
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: "Identificador da reserva (booking)."
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [gross_amount, channel]
 *             properties:
 *               gross_amount:
 *                 type: number
 *                 format: float
 *                 example: 500.0
 *               fee_amount:
 *                 type: number
 *                 format: float
 *                 example: 5.0
 *               channel:
 *                 type: string
 *                 example: "PIX"
 *               kind:
 *                 type: string
 *                 example: "DEPOSIT"
 *               provider_code:
 *                 type: string
 *                 nullable: true
 *                 example: "MPAY-123"
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
 *         description: "Reserva (booking) não encontrada."
 */
export const registerPayment = async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const {
      gross_amount,
      fee_amount,
      channel,
      kind,
      provider_code,
    } = req.body as {
      gross_amount?: number;
      fee_amount?: number;
      channel?: string;
      kind?: string;
      provider_code?: string | null;
    };

    if (gross_amount == null || isNaN(Number(gross_amount)) || Number(gross_amount) <= 0) {
      return res.status(400).json({ error: 'invalid_gross_amount' });
    }
    if (!channel || typeof channel !== 'string') {
      return res.status(400).json({ error: 'invalid_channel' });
    }

    // Verifica se a reserva existe
    const bookingCheck = await pool.query(
      'SELECT id FROM reservations WHERE id = $1',
      [bookingId],
    );
    if (bookingCheck.rowCount === 0) {
      return res.status(404).json({ error: 'booking_not_found' });
    }

    const paymentId = uuid();
    const fee = fee_amount != null && !isNaN(Number(fee_amount)) && Number(fee_amount) >= 0
      ? Number(fee_amount)
      : 0;

    const net = Number(gross_amount) - fee;

    const params: SqlParam[] = [
      paymentId,
      bookingId,
      Number(gross_amount),
      fee,
      net,
      channel,
      'PENDING',
      kind ?? 'DEPOSIT',
      provider_code ?? null,
    ];

    const sql = `
      INSERT INTO payments
        (id, booking_id, gross_amount, fee_amount, net_amount,
         channel, status, kind, provider_code)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;

    const { rows } = await pool.query(sql, params);
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
    const { rows } = await pool.query('SELECT * FROM payments WHERE id = $1', [paymentId]);

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
 * /payments/{paymentId}/settle:
 *   patch:
 *     summary: Marca um pagamento como liquidado (CLEARED)
 *     description: "Altera o status para CLEARED e registra a data/hora de liquidação."
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
 *               provider_code:
 *                 type: string
 *                 nullable: true
 *                 example: "gateway-xyz-999"
 *               settled_at:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 description: "Se omitido, será usado NOW() do banco."
 *     responses:
 *       200:
 *         description: "Pagamento liquidado."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Payment"
 *       404:
 *         description: "Pagamento não encontrado."
 */
export const settlePayment = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const { provider_code, settled_at } = req.body as {
      provider_code?: string | null;
      settled_at?: string | null;
    };

    const existing = await pool.query(
      'SELECT status FROM payments WHERE id = $1',
      [paymentId],
    );
    if (!existing.rows[0]) {
      return res.status(404).json({ error: 'payment_not_found' });
    }

    const sql = `
      UPDATE payments
      SET status        = 'CLEARED',
          cleared_at    = COALESCE($2::timestamptz, NOW()),
          provider_code = COALESCE($3, provider_code),
          updated_at    = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const params: SqlParam[] = [paymentId, settled_at ?? null, provider_code ?? null];
    const { rows } = await pool.query(sql, params);

    return res.json(rows[0]);
  } catch (err) {
    return sendInternalError(res, err, 'settlePayment');
  }
};

/**
 * @openapi
 * /payments/{paymentId}:
 *   delete:
 *     summary: Exclui um lançamento de pagamento
 *     description: "Remoção permitida apenas se o pagamento não estiver CLEARED."
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
    if (lookup.rows[0].status === 'CLEARED') {
      return res.status(400).json({ error: 'cannot_delete_cleared_payment' });
    }

    await pool.query('DELETE FROM payments WHERE id = $1', [paymentId]);
    return res.status(204).send();
  } catch (err) {
    return sendInternalError(res, err, 'removePayment');
  }
};

export {};
