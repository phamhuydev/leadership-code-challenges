import express, { ErrorRequestHandler } from 'express';
import { UniqueConstraintError } from 'sequelize';
import { ZodError } from 'zod';
import { healthRouter } from './routes/health';
import { membersRouter } from './routes/members';
import { fundingRouter } from './routes/funding';
import { walletsRouter } from './routes/wallets';
import { DomainError } from './services/errors';

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'validation_error', details: err.issues });
    return;
  }
  if (err instanceof DomainError) {
    res.status(err.status).json({ error: err.code, ...err.details });
    return;
  }
  if (err instanceof UniqueConstraintError) {
    res.status(409).json({ error: 'already_exists' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
};

export function createApp() {
  const app = express();
  app.use(express.json());

  app.use('/health', healthRouter);
  app.use('/members', membersRouter);
  app.use(fundingRouter);
  app.use('/wallets', walletsRouter);

  app.use(errorHandler);
  return app;
}
