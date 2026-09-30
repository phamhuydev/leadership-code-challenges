import { Router } from 'express';
import { z } from 'zod';
import { applyPspCallback, createDeposit, createWithdrawal } from '../services/walletService';

export const fundingRouter = Router();

const moneyString = z.string().regex(/^\d+(?:\.\d{1,18})?$/, 'must be a positive decimal string');
const depositBody = z.object({
  memberId: z.string().uuid(),
  amount: moneyString,
  turnoverMultiplier: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(1),
});
const callbackBody = z.object({
  pspRef: z.string().uuid(),
  status: z.enum(['completed', 'failed']),
  amount: moneyString,
});
const withdrawalBody = z.object({
  memberId: z.string().uuid(),
  amount: moneyString,
});

fundingRouter.post('/deposits', async (req, res, next) => {
  try {
    const { memberId, amount, turnoverMultiplier } = depositBody.parse(req.body);
    const transaction = await createDeposit(memberId, amount, turnoverMultiplier);
    res.status(201).json({ id: transaction.id, pspRef: transaction.pspRef, status: transaction.status });
  } catch (err) {
    next(err);
  }
});

fundingRouter.post('/psp/callbacks', async (req, res, next) => {
  try {
    const { pspRef, status, amount } = callbackBody.parse(req.body);
    const result = await applyPspCallback(pspRef, status, amount);
    res.status(200).json({ id: result.transaction.id, status: result.transaction.status, applied: result.applied });
  } catch (err) {
    next(err);
  }
});

fundingRouter.post('/withdrawals', async (req, res, next) => {
  try {
    const { memberId, amount } = withdrawalBody.parse(req.body);
    const { transaction, wallet } = await createWithdrawal(memberId, amount);
    res.status(201).json({
      id: transaction.id,
      status: transaction.status,
      wallet: { id: wallet.id, balance: wallet.balance },
    });
  } catch (err) {
    next(err);
  }
});
