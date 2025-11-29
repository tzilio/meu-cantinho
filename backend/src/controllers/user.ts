// src/controllers/user.ts
import { Request, Response } from 'express';
import { pool } from 'db';
import { v4 as uuid } from 'uuid';

type SqlParam = string | number | boolean | null;

function sendInternalError(res: Response, err: unknown, context: string) {
  console.error(`[users:${context}]`, err);
  return res.status(500).json({ error: 'internal_error', context });
}

/**
 * @openapi
 * components:
 *   schemas:
 *     User:
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
 *         role:
 *           type: string
 *           enum: [CUSTOMER, ADMIN, MANAGER]
 *           example: CUSTOMER
 *         last_login_at:
 *           type: string
 *           format: date-time
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
 * /users:
 *   post:
 *     summary: Cria um novo usuário
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
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
 *               role:
 *                 type: string
 *                 enum: [CUSTOMER, ADMIN, MANAGER]
 *                 example: CUSTOMER
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       201:
 *         description: Usuário criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: E-mail já cadastrado
 */
export const createUser = async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      phone,
      role,
      password,
    } = req.body as {
      name?: string;
      email?: string;
      phone?: string | null;
      role?: string;
      password?: string;
    };

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'invalid_name' });
    }
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'invalid_email' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'invalid_password' });
    }

    const normalizedRole = role ?? 'CUSTOMER';
    if (!['CUSTOMER', 'ADMIN', 'MANAGER'].includes(normalizedRole)) {
      return res.status(400).json({ error: 'invalid_role' });
    }

    // Confere se o e-mail já existe
    const emailCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email],
    );
    if (emailCheck.rowCount > 0) {
      return res.status(409).json({ error: 'email_already_in_use' });
    }

    const userId = uuid();

    // Aqui você poderia aplicar hash de senha (bcrypt, etc.).
    // Por simplicidade, estamos gravando diretamente em password_hash.
    const sql = `
      INSERT INTO users
        (id, name, email, phone, role, password_hash)
      VALUES
        ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, email, phone, role, last_login_at, created_at, updated_at;
    `;

    const params: SqlParam[] = [
      userId,
      name,
      phone ?? null,
      email,
      normalizedRole,
      password, // TODO: aplicar hash real em produção
    ];

    const { rows } = await pool.query(sql, params);
    return res.status(201).json(rows[0]);
  } catch (err) {
    return sendInternalError(res, err, 'createUser');
  }
};

/**
 * @openapi
 * /users:
 *   get:
 *     summary: Lista usuários
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: role
 *         required: false
 *         schema:
 *           type: string
 *           enum: [CUSTOMER, ADMIN, MANAGER]
 *         description: Filtra por papel do usuário.
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *         description: Busca parcial por nome ou e-mail.
 *     responses:
 *       200:
 *         description: Lista de usuários
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 */
export const listUsers = async (req: Request, res: Response) => {
  try {
    const { role, search } = req.query as {
      role?: string;
      search?: string;
    };

    const params: SqlParam[] = [];
    const conditions: string[] = [];

    if (role) {
      conditions.push('role = $' + (params.length + 1));
      params.push(role);
    }

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

    let sql = 'SELECT id, name, email, phone, role, last_login_at, created_at, updated_at FROM users';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY created_at DESC';

    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    return sendInternalError(res, err, 'listUsers');
  }
};

/**
 * @openapi
 * /users/{userId}:
 *   get:
 *     summary: Detalhes de um usuário
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Usuário encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: Usuário não encontrado
 */
export const fetchUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { rows } = await pool.query(
      'SELECT id, name, email, phone, role, last_login_at, created_at, updated_at FROM users WHERE id = $1',
      [userId],
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    return res.json(rows[0]);
  } catch (err) {
    return sendInternalError(res, err, 'fetchUser');
  }
};

/**
 * @openapi
 * /users/{userId}:
 *   patch:
 *     summary: Atualiza dados de um usuário
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
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
 *               phone:
 *                 type: string
 *                 nullable: true
 *               role:
 *                 type: string
 *                 enum: [CUSTOMER, ADMIN, MANAGER]
 *     responses:
 *       200:
 *         description: Usuário atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Nenhum campo válido enviado
 *       404:
 *         description: Usuário não encontrado
 */
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const {
      name,
      phone,
      role,
    } = req.body as {
      name?: string;
      phone?: string | null;
      role?: string;
    };

    const lookup = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [userId],
    );
    if (!lookup.rows[0]) {
      return res.status(404).json({ error: 'user_not_found' });
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

    if (role !== undefined) {
      if (!['CUSTOMER', 'ADMIN', 'MANAGER'].includes(role)) {
        return res.status(400).json({ error: 'invalid_role' });
      }
      fields.push(`role = $${paramIndex++}`);
      params.push(role);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'no_valid_fields' });
    }

    fields.push('updated_at = NOW()');

    const sql = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, email, phone, role, last_login_at, created_at, updated_at;
    `;
    params.push(userId);

    const { rows } = await pool.query(sql, params);
    return res.json(rows[0]);
  } catch (err) {
    return sendInternalError(res, err, 'updateUser');
  }
};

/**
 * @openapi
 * /users/{userId}:
 *   delete:
 *     summary: Remove um usuário
 *     description: Pode ser bloqueado via regra de negócio se houver reservas associadas.
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Usuário removido
 *       404:
 *         description: Usuário não encontrado
 */
export const removeUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Se quiser impedir remoção com reservas, dá pra checar aqui:
    // SELECT 1 FROM reservations WHERE customer_id = $1 LIMIT 1;

    const result = await pool.query(
      'DELETE FROM users WHERE id = $1',
      [userId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    return res.status(204).send();
  } catch (err) {
    return sendInternalError(res, err, 'removeUser');
  }
};

export {};
