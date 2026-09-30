import { Router } from 'express';
import { sequelize } from '../db/sequelize';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res, next) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});
