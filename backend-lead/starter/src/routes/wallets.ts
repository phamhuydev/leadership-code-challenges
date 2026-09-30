import { Router } from 'express';
import { z } from 'zod';
import { recordWager } from '../services/walletService';

export const walletsRouter = Router();

const moneyString = z.string().regex(/^\d+(?:\.\d{1,18})?$/, 'must be a positive decimal string');
const wagerBody = z.object({ amount: moneyString });
const walletParams = z.object({ walletId: z.string().uuid() });

walletsRouter.post('/:walletId/wagers', async (req, res, next) => {
  try {
    const { walletId } = walletParams.parse(req.params);
    const { amount } = wagerBody.parse(req.body);
    const wallet = await recordWager(walletId, amount);
    res.status(201).json({
      wallet: {
        id: wallet.id,
        memberId: wallet.memberId,
        balance: wallet.balance,
        turnoverAccrued: wallet.turnoverAccrued,
      },
    });
  } catch (err) {
    next(err);
  }
});
