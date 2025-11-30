// src/controllers/space.ts
import { Request, Response } from 'express';
import { pool } from '../db';
import { v4 as uuid } from 'uuid';

type SqlParam = string | number | boolean | null;

function sendInternalError(res: Response, err: unknown, context: string) {
  console.error(`[spaces:${context}]`, err);
  return res.status(500).json({ error: 'internal_error', context });
}

/**
 * @openapi
 * components:
 *   schemas:
 *     Space:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         branch_id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         capacity:
 *           type: integer
 *         price_per_hour:
 *           type: number
 *           format: float
 *         active:
 *           type: boolean
 *         cover_url:
 *           type: string
 *           nullable: true
 *           description: URL pública da foto de capa do espaço
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

/**
 * @openapi
 * /branches/{branchId}/spaces:
 *   post:
 *     summary: Cria um espaço em uma filial
 *     tags: [Spaces]
 *     parameters:
 *       - in: path
 *         name: branchId
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
 *             required: [name, capacity, price_per_hour]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *                 nullable: true
 *               capacity:
 *                 type: integer
 *                 example: 100
 *               price_per_hour:
 *                 type: number
 *                 format: float
 *                 example: 250.0
 *               active:
 *                 type: boolean
 *                 example: true
 *               cover_url:
 *                 type: string
 *                 nullable: true
 *                 description: URL pública da foto de capa do espaço
 *     responses:
 *       201:
 *         description: Espaço criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Space"
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Branch não encontrada
 */
export const createSpace = async (req: Request, res: Response) => {
  try {
    const { branchId } = req.params;
    const {
      name,
      description,
      capacity,
      price_per_hour,
      active,
      cover_url,
    } = req.body as {
      name?: string;
      description?: string | null;
      capacity?: number;
      price_per_hour?: number;
      active?: boolean;
      cover_url?: string | null;
    };

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'invalid_name' });
    }
    if (capacity == null || isNaN(Number(capacity)) || Number(capacity) <= 0) {
      return res.status(400).json({ error: 'invalid_capacity' });
    }
    if (price_per_hour == null || isNaN(Number(price_per_hour)) || Number(price_per_hour) < 0) {
      return res.status(400).json({ error: 'invalid_price_per_hour' });
    }

    // Confere se a branch existe
    const branchCheck = await pool.query(
      'SELECT id FROM branches WHERE id = $1',
      [branchId],
    );
    if (branchCheck.rowCount === 0) {
      return res.status(404).json({ error: 'branch_not_found' });
    }

    const spaceId = uuid();
    const sql = `
      INSERT INTO spaces
        (id, branch_id, name, description, capacity, price_per_hour, active, cover_url)
      VALUES
        ($1, $2, $3, $4, $5, $6, COALESCE($7, TRUE), $8)
      RETURNING *;
    `;

    const params: SqlParam[] = [
      spaceId,
      branchId,
      name,
      description ?? null,
      Number(capacity),
      Number(price_per_hour),
      active ?? true,
      cover_url ?? null,
    ];

    const { rows } = await pool.query(sql, params);
    return res.status(201).json(rows[0]);
  } catch (err) {
    return sendInternalError(res, err, 'createSpace');
  }
};

/**
 * @openapi
 * /branches/{branchId}/spaces:
 *   get:
 *     summary: Lista espaços de uma filial
 *     tags: [Spaces]
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: only_active
 *         required: false
 *         schema:
 *           type: boolean
 *         description: "Se true, retorna apenas espaços ativos."
 *     responses:
 *       200:
 *         description: Lista de espaços
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/Space"
 *       404:
 *         description: Branch não encontrada
 */
export const listSpacesByBranch = async (req: Request, res: Response) => {
  try {
    const { branchId } = req.params;
    const { only_active } = req.query as { only_active?: string };

    const branchCheck = await pool.query(
      'SELECT id FROM branches WHERE id = $1',
      [branchId],
    );
    if (branchCheck.rowCount === 0) {
      return res.status(404).json({ error: 'branch_not_found' });
    }

    const onlyActive = only_active === 'true';

    let sql = 'SELECT * FROM spaces WHERE branch_id = $1';
    const params: SqlParam[] = [branchId];

    if (onlyActive) {
      sql += ' AND active = TRUE';
    }

    sql += ' ORDER BY name ASC';

    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    return sendInternalError(res, err, 'listSpacesByBranch');
  }
};

/**
 * @openapi
 * /spaces/{spaceId}:
 *   get:
 *     summary: Detalhes de um espaço
 *     tags: [Spaces]
 *     parameters:
 *       - in: path
 *         name: spaceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Espaço encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Space"
 *       404:
 *         description: Espaço não encontrado
 */
export const fetchSpace = async (req: Request, res: Response) => {
  try {
    const { spaceId } = req.params;
    const { rows } = await pool.query(
      'SELECT * FROM spaces WHERE id = $1',
      [spaceId],
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'space_not_found' });
    }

    return res.json(rows[0]);
  } catch (err) {
    return sendInternalError(res, err, 'fetchSpace');
  }
};

/**
 * @openapi
 * /spaces/{spaceId}:
 *   patch:
 *     summary: Atualiza informações de um espaço
 *     tags: [Spaces]
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
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *                 nullable: true
 *               capacity:
 *                 type: integer
 *               price_per_hour:
 *                 type: number
 *                 format: float
 *               active:
 *                 type: boolean
 *               cover_url:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Espaço atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Space"
 *       400:
 *         description: Nenhum campo válido enviado
 *       404:
 *         description: Espaço não encontrado
 */
export const updateSpace = async (req: Request, res: Response) => {
  try {
    const { spaceId } = req.params;
    const {
      name,
      description,
      capacity,
      price_per_hour,
      active,
      cover_url,
    } = req.body as {
      name?: string;
      description?: string | null;
      capacity?: number;
      price_per_hour?: number;
      active?: boolean;
      cover_url?: string | null;
    };

    const lookup = await pool.query(
      'SELECT * FROM spaces WHERE id = $1',
      [spaceId],
    );
    if (!lookup.rows[0]) {
      return res.status(404).json({ error: 'space_not_found' });
    }

    const fields: string[] = [];
    const params: SqlParam[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      params.push(description);
    }
    if (capacity !== undefined) {
      if (isNaN(Number(capacity)) || Number(capacity) <= 0) {
        return res.status(400).json({ error: 'invalid_capacity' });
      }
      fields.push(`capacity = $${paramIndex++}`);
      params.push(Number(capacity));
    }
    if (price_per_hour !== undefined) {
      if (isNaN(Number(price_per_hour)) || Number(price_per_hour) < 0) {
        return res.status(400).json({ error: 'invalid_price_per_hour' });
      }
      fields.push(`price_per_hour = $${paramIndex++}`);
      params.push(Number(price_per_hour));
    }
    if (active !== undefined) {
      fields.push(`active = $${paramIndex++}`);
      params.push(active);
    }
    if (cover_url !== undefined) {
      fields.push(`cover_url = $${paramIndex++}`);
      params.push(cover_url);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'no_valid_fields' });
    }

    fields.push(`updated_at = NOW()`);

    const sql = `
      UPDATE spaces
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *;
    `;
    params.push(spaceId);

    const { rows } = await pool.query(sql, params);
    return res.json(rows[0]);
  } catch (err) {
    return sendInternalError(res, err, 'updateSpace');
  }
};

export const deleteSpace = async (req: Request, res: Response) => {
  try {
    const { spaceId } = req.params;

    const result = await pool.query(
      "DELETE FROM spaces WHERE id = $1",
      [spaceId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "space_not_found" });
    }

    return res.status(204).send();
  } catch (err) {
    console.error("deleteSpace:", err);
    return res.status(500).json({ error: "internal_error" });
  }
};


export {};
