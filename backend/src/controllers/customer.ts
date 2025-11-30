// src/controllers/customer.ts
import { Request, Response } from 'express';
import { pool } from '../db';
import { v4 as uuid } from 'uuid';

type SqlParam = string | number | boolean | null;

function sendInternalError(res: Response, err: unknown, context: string) {
  console.error(`[customers:${context}]`, err);
  return res.status(500).json({ error: 'internal_error', context });
}

/**
 * @openapi
 * components:
 *   schemas:
 *     Customer:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         phone:
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
 * /customers:
 *   post:
 *     summary: Cria um novo cliente
 *     tags: [Customers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email]
 *             properties:
 *               name:
 *                 type: string
 *                 example: 'Maria da Silva'
 *               email:
 *                 type: string
 *                 format: email
 *                 example: 'maria@example.com'
 *               phone:
 *                 type: string
 *                 example: '+55 41 99999-0000'
 *     responses:
 *       201:
 *         description: Cliente criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Customer'
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: E-mail já cadastrado
 */
export const createCustomer = async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      phone,
    } = req.body as {
      name?: string;
      email?: string;
      phone?: string | null;
    };

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'invalid_name' });
    }
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'invalid_email' });
    }

    // Confere se o e-mail já existe
    const emailCheck = await pool.query(
      'SELECT id FROM customers WHERE email = $1',
      [email],
    );
    if (emailCheck.rowCount > 0) {
      return res.status(409).json({ error: 'email_already_in_use' });
    }

    const customerId = uuid();

    const sql = `
      INSERT INTO customers
        (id, name, email, phone)
      VALUES
        ($1, $2, $3, $4)
      RETURNING id, name, email, phone, created_at, updated_at;
    `;

    const params: SqlParam[] = [
      customerId,
      name,
      email,
      phone ?? null,
    ];

    const { rows } = await pool.query(sql, params);
    return res.status(201).json(rows[0]);
  } catch (err) {
    return sendInternalError(res, err, 'createCustomer');
  }
};

/**
 * @openapi
 * /customers:
 *   get:
 *     summary: Lista clientes
 *     tags: [Customers]
 *     parameters:
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *         description: Busca parcial por nome ou e-mail.
 *     responses:
 *       200:
 *         description: Lista de clientes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Customer'
 */
export const listCustomers = async (req: Request, res: Response) => {
  try {
    const { search } = req.query as {
      search?: string;
    };

    const params: SqlParam[] = [];
    const conditions: string[] = [];

    if (search) {
      conditions.push(
        '(name ILIKE $' +
          (params.length + 1) +
          ' OR email ILIKE $' +
          (params.length + 2) +
          ')',
      );
      params.push(`%${search}%`, `%${search}%`);
    }

    let sql =
      'SELECT id, name, email, phone, created_at, updated_at FROM customers';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY created_at DESC';

    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    return sendInternalError(res, err, 'listCustomers');
  }
};

/**
 * @openapi
 * /customers/{customerId}:
 *   get:
 *     summary: Detalhes de um cliente
 *     tags: [Customers]
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Cliente encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Customer'
 *       404:
 *         description: Cliente não encontrado
 */
export const fetchCustomer = async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { rows } = await pool.query(
      'SELECT id, name, email, phone, created_at, updated_at FROM customers WHERE id = $1',
      [customerId],
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'customer_not_found' });
    }

    return res.json(rows[0]);
  } catch (err) {
    return sendInternalError(res, err, 'fetchCustomer');
  }
};

/**
 * @openapi
 * /customers/{customerId}:
 *   patch:
 *     summary: Atualiza dados de um cliente
 *     tags: [Customers]
 *     parameters:
 *       - in: path
 *         name: customerId
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
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Cliente atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Customer'
 *       400:
 *         description: Nenhum campo válido enviado ou dados inválidos
 *       404:
 *         description: Cliente não encontrado
 *       409:
 *         description: E-mail já cadastrado em outro cliente
 */
export const updateCustomer = async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const {
      name,
      phone,
      email,
    } = req.body as {
      name?: string;
      phone?: string | null;
      email?: string;
    };

    // Confere se o cliente existe
    const lookup = await pool.query(
      'SELECT id FROM customers WHERE id = $1',
      [customerId],
    );
    if (!lookup.rows[0]) {
      return res.status(404).json({ error: 'customer_not_found' });
    }

    // Se veio email, valida e checa unicidade (exceto o próprio customerId)
    if (email !== undefined) {
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'invalid_email' });
      }

      const emailCheck = await pool.query(
        'SELECT id FROM customers WHERE email = $1 AND id <> $2',
        [email, customerId],
      );
      if (emailCheck.rowCount > 0) {
        return res.status(409).json({ error: 'email_already_in_use' });
      }
    }

    const fields: string[] = [];
    const params: SqlParam[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      params.push(name);
    }

    if (phone !== undefined) {
      fields.push(`phone = $${paramIndex++}`);
      params.push(phone);
    }

    if (email !== undefined) {
      fields.push(`email = $${paramIndex++}`);
      params.push(email);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'no_valid_fields' });
    }

    fields.push('updated_at = NOW()');

    const sql = `
      UPDATE customers
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, email, phone, created_at, updated_at;
    `;
    params.push(customerId);

    const { rows } = await pool.query(sql, params);
    return res.json(rows[0]);
  } catch (err) {
    return sendInternalError(res, err, 'updateCustomer');
  }
};


/**
 * @openapi
 * /customers/{customerId}:
 *   delete:
 *     summary: Remove um cliente
 *     description: Pode ser bloqueado via regra de negócio se houver reservas associadas.
 *     tags: [Customers]
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Cliente removido
 *       404:
 *         description: Cliente não encontrado
 */
export const removeCustomer = async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    // Se quiser impedir remoção com reservas, dá pra checar aqui:
    // SELECT 1 FROM reservations WHERE customer_id = $1 LIMIT 1;

    const result = await pool.query(
      'DELETE FROM customers WHERE id = $1',
      [customerId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'customer_not_found' });
    }

    return res.status(204).send();
  } catch (err) {
    return sendInternalError(res, err, 'removeCustomer');
  }
};

export {};
