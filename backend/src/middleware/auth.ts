// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'CHANGE_ME_IN_ENV';

export type AuthRole = 'ADMIN' | 'MANAGER' | 'CUSTOMER';

export interface AuthPayload {
  sub: string;           // id do usuário
  role: AuthRole;
  email?: string;
}

// Augmenta o tipo do Express pra ter req.user
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/**
 * Middleware de validação de token JWT.
 * Usa o header Authorization: Bearer <token>.
 * Se optional = true, deixa passar mesmo sem token (req.user fica undefined).
 */
export function tokenValidation(optional = false) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];

    if (!authHeader || typeof authHeader !== 'string') {
      if (optional) return next();
      return res.status(401).json({ error: 'missing_authorization_header' });
    }

    const [scheme, token] = authHeader.split(' ');

    if (!/^Bearer$/i.test(scheme) || !token) {
      if (optional) return next();
      return res.status(401).json({ error: 'invalid_authorization_format' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
      req.user = decoded;
      return next();
    } catch (err) {
      if (optional) return next();
      console.error('[auth:tokenValidation] invalid token', err);
      return res.status(401).json({ error: 'invalid_token' });
    }
  };
}

/**
 * Middleware de autorização por papel.
 * Exemplo:
 *   router.get('/customers', tokenValidation(), authorize('ADMIN', 'MANAGER'), handler);
 */
export function authorize(...allowedRoles: AuthRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'unauthenticated' });
    }

    if (allowedRoles.length === 0) {
      // se não passar roles, qualquer usuário autenticado passa
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'forbidden',
        message: `role ${req.user.role} is not allowed for this resource`,
      });
    }

    return next();
  };
}

/**
 * Helper opcional pra gerar token no controller de login.
 * Pode ser usado em loginUser:
 *
 *   const token = generateToken({ id: user.id, role: user.role, email: user.email });
 */
export function generateToken(payload: { id: string; role: AuthRole; email?: string }, expiresIn = '8h'): string {
  const tokenPayload: AuthPayload = {
    sub: payload.id,
    role: payload.role,
    email: payload.email,
  };

  return jwt.sign(tokenPayload, JWT_SECRET, { expiresIn });
}

export {};
