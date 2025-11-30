// backend/src/services/app.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import path from 'path';

import { swaggerSpec } from './swagger';
import router from './routes/index';
import uploadsRouter from './routes/uploads';

const app = express();

// Middlewares básicos
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Arquivos estáticos de upload (PRECISA vir antes do 404)
app.use(
  '/uploads',
  express.static(path.resolve('uploads')),
);

// Rotas de upload (inclui POST /space-cover)
app.use(uploadsRouter);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Rotas principais da API (branches, spaces, etc.)
app.use('/', router);

// Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));

// 404 handler (sempre DEPOIS de todas as rotas)
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'NotFound',
    message: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
  });
});

// Tratamento genérico de erros (por último)
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = (err as any)?.statusCode || 500;
  const message = (err as any)?.message || 'Erro interno no servidor';
  res.status(status).json({ error: 'InternalError', message });
});

export default app;
