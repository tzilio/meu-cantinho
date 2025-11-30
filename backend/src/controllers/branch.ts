import { Request, Response } from 'express';
import { pool } from '../db';
import { v4 as uuid } from 'uuid';

type BranchRecord = {
  id: string;
  name: string;
  state: string;
  city: string;
  address: string;
  created_at: string | null;
  updated_at: string | null;
};

async function fetchBranchOr404(id: string, res: Response): Promise<BranchRecord | undefined> {
  const result = await pool.query('SELECT * FROM branches WHERE id = $1', [id]);
  if (!result.rows[0]) {
    res.status(404).json({ error: 'branch_not_found' });
    return undefined;
  }
  return result.rows[0] as BranchRecord;
}

/**
 * @openapi
 * /branches:
 *   post:
 *     summary: Cadastra uma nova filial
 *     description: 'Cria uma filial informando nome, estado, cidade e endereço completo.'
 *     tags: [Branches]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, state, city, address]
 *             properties:
 *               name:
 *                 type: string
 *                 example: 'Unidade Centro'
 *               state:
 *                 type: string
 *                 example: 'PR'
 *               city:
 *                 type: string
 *                 example: 'Curitiba'
 *               address:
 *                 type: string
 *                 example: 'Rua XV de Novembro, 123 - Centro'
 *     responses:
 *       201:
 *         description: 'Filial criada com sucesso.'
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Branch'
 *       400:
 *         description: 'Dados obrigatórios ausentes.'
 */
export const registerBranch = async (req: Request, res: Response) => {
  try {
    const { name, state, city, address } = req.body as {
      name?: string;
      state?: string;
      city?: string;
      address?: string;
    };

    if (
      !name?.trim() ||
      !state?.trim() ||
      !city?.trim() ||
      !address?.trim()
    ) {
      return res.status(400).json({ error: 'name_state_city_address_required' });
    }

    const id = uuid();
    const insertSql = `
      INSERT INTO branches (id, name, state, city, address)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, state, city, address, created_at, updated_at
    `;
    const { rows } = await pool.query(insertSql, [
      id,
      name.trim(),
      state.trim(),
      city.trim(),
      address.trim(),
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('registerBranch failed:', err);
    res.status(500).json({ error: 'internal_error' });
  }
};

/**
 * @openapi
 * /branches:
 *   get:
 *     summary: Busca filiais
 *     description: 'Pesquisa filiais opcionalmente pelo trecho do nome, cidade, estado ou endereço.'
 *     tags: [Branches]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: false
 *         schema:
 *           type: string
 *           example: 'Curitiba'
 *         description: 'Trecho do nome, cidade, estado ou endereço.'
 *     responses:
 *       200:
 *         description: 'Lista de filiais encontradas.'
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Branch'
 */
export const searchBranches = async (req: Request, res: Response) => {
  try {
    const { q } = req.query as { q?: string };

    const baseSelect = `
      SELECT id, name, state, city, address, created_at, updated_at
      FROM branches
    `;

    if (!q || !q.trim()) {
      const { rows } = await pool.query(
        `${baseSelect} ORDER BY created_at DESC, name ASC`
      );
      return res.json(rows);
    }

    const term = `%${q.trim()}%`;
    const sql = `
      ${baseSelect}
      WHERE name ILIKE $1
         OR city ILIKE $1
         OR state ILIKE $1
         OR address ILIKE $1
      ORDER BY created_at DESC, name ASC
    `;
    const { rows } = await pool.query(sql, [term]);
    res.json(rows);
  } catch (err) {
    console.error('searchBranches failed:', err);
    res.status(500).json({ error: 'internal_error' });
  }
};

/**
 * @openapi
 * /branches/{id}:
 *   get:
 *     summary: Detalhes de uma filial
 *     tags: [Branches]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 'Filial encontrada.'
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Branch'
 *       404:
 *         description: 'Filial não encontrada.'
 */
export const getBranchById = async (req: Request, res: Response) => {
  try {
    const branch = await fetchBranchOr404(req.params.id, res);
    if (!branch) return;
    res.json(branch);
  } catch (err) {
    console.error('getBranchById failed:', err);
    res.status(500).json({ error: 'internal_error' });
  }
};

/**
 * @openapi
 * /branches/{id}:
 *   patch:
 *     summary: Atualiza parcialmente uma filial
 *     description: 'Permite alterar nome, estado, cidade e/ou endereço. Campos não enviados são mantidos.'
 *     tags: [Branches]
 *     parameters:
 *       - in: path
 *         name: id
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
 *               state:
 *                 type: string
 *               city:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       200:
 *         description: 'Filial atualizada.'
 *       400:
 *         description: 'Nenhum campo informado para atualização.'
 *       404:
 *         description: 'Filial não encontrada.'
 */
export const patchBranch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, state, city, address } = req.body as {
      name?: string;
      state?: string;
      city?: string;
      address?: string;
    };

    if (
      name === undefined &&
      state === undefined &&
      city === undefined &&
      address === undefined
    ) {
      return res.status(400).json({ error: 'no_fields_to_update' });
    }

    const sql = `
      UPDATE branches
         SET name       = COALESCE($2, name),
             state      = COALESCE($3, state),
             city       = COALESCE($4, city),
             address    = COALESCE($5, address),
             updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, state, city, address, created_at, updated_at
    `;

    const { rows } = await pool.query(sql, [
      id,
      name ?? null,
      state ?? null,
      city ?? null,
      address ?? null,
    ]);

    if (!rows[0]) {
      return res.status(404).json({ error: 'branch_not_found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('patchBranch failed:', err);
    res.status(500).json({ error: 'internal_error' });
  }
};

/**
 * @openapi
 * /branches/{id}:
 *   delete:
 *     summary: Remove uma filial
 *     tags: [Branches]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: 'Filial removida com sucesso.'
 *       404:
 *         description: 'Filial não encontrada.'
 */
export const removeBranch = async (req: Request, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM branches WHERE id = $1',
      [req.params.id]
    );

    if (!rowCount) {
      return res.status(404).json({ error: 'branch_not_found' });
    }

    res.status(204).send();
  } catch (err) {
    console.error('removeBranch failed:', err);
    res.status(500).json({ error: 'internal_error' });
  }
};

/**
 * @openapi
 * /branches/{id}/spaces:
 *   get:
 *     summary: Lista os espaços de uma filial
 *     tags: [Branches, Spaces]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 'Espaços da filial.'
 *       404:
 *         description: 'Filial não encontrada.'
 */
export const listBranchSpaces = async (req: Request, res: Response) => {
  try {
    const branch = await fetchBranchOr404(req.params.id, res);
    if (!branch) return;

    const { rows } = await pool.query(
      'SELECT * FROM spaces WHERE branch_id = $1 ORDER BY name ASC',
      [branch.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('listBranchSpaces failed:', err);
    res.status(500).json({ error: 'internal_error' });
  }
};

/**
 * @openapi
 * components:
 *   schemas:
 *     Branch:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         state:
 *           type: string
 *           example: 'PR'
 *         city:
 *           type: string
 *           example: 'Curitiba'
 *         address:
 *           type: string
 *           example: 'Rua XV de Novembro, 123 - Centro'
 *         created_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         updated_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 */
export {};
