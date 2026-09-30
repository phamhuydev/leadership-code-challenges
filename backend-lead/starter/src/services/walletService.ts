import { randomUUID } from 'crypto';
import BigNumber from 'bignumber.js';
import { Transaction } from 'sequelize';
import { dec, ZERO } from '../lib/money';
import { FundingTransaction, Wallet, WalletTransaction } from '../db/models';
import { sequelize } from '../db/sequelize';
import { DomainError } from './errors';
import { assertStorableMoney, moneyString, positiveMoney } from './moneyService';

type CallbackStatus = 'completed' | 'failed';

type CallbackResult = {
  transaction: FundingTransaction;
  applied: boolean;
};

/**
 * Returns a wallet locked for update. Every writer of a member's balance and
 * turnover counters takes this same lock, making the check-and-update sequence
 * serializable for that wallet.
 */
async function lockedWallet(walletId: string, transaction: Transaction): Promise<Wallet> {
  const wallet = await Wallet.findByPk(walletId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!wallet) {
    throw new DomainError(404, 'wallet_not_found');
  }
  return wallet;
}

async function lockedWalletForMember(memberId: string, transaction: Transaction): Promise<Wallet> {
  const wallet = await Wallet.findOne({
    where: { memberId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!wallet) {
    throw new DomainError(404, 'wallet_not_found');
  }
  return wallet;
}

function withdrawalOutstanding(wallet: Wallet): BigNumber {
  return BigNumber.maximum(ZERO, dec(wallet.turnoverRequired).minus(dec(wallet.turnoverAccrued)));
}

/** Creates a pending deposit. The PSP callback is the only place a deposit credits a wallet. */
export async function createDeposit(
  memberId: string,
  amountInput: string,
  turnoverMultiplier: number,
): Promise<FundingTransaction> {
  const amount = positiveMoney(amountInput);
  const turnoverRequirement = amount.times(String(turnoverMultiplier));
  assertStorableMoney(turnoverRequirement);

  return sequelize.transaction(async (transaction) => {
    // Locking the wallet here verifies that the member exists and serializes setup with withdrawal operations.
    await lockedWalletForMember(memberId, transaction);
    return FundingTransaction.create(
      {
        memberId,
        type: 'deposit',
        status: 'pending',
        amount: moneyString(amount),
        pspRef: randomUUID(),
        turnoverMultiplier,
      },
      { transaction },
    );
  });
}

/**
 * Applies a normalized PSP callback exactly once. The transaction row lock
 * serializes duplicate deliveries, while the unique ledger reference is a
 * second database-level guard against accidentally writing two deposit lines.
 */
export async function applyPspCallback(
  pspRef: string,
  status: CallbackStatus,
  amountInput: string,
): Promise<CallbackResult> {
  const callbackAmount = positiveMoney(amountInput);

  return sequelize.transaction(async (transaction) => {
    const fundingTransaction = await FundingTransaction.findOne({
      where: { pspRef },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!fundingTransaction) {
      throw new DomainError(404, 'funding_transaction_not_found');
    }
    if (fundingTransaction.type !== 'deposit') {
      throw new DomainError(409, 'unsupported_callback_transaction');
    }
    if (!dec(fundingTransaction.amount).eq(callbackAmount)) {
      // A mismatched amount is never credited or transitioned; it needs reconciliation.
      throw new DomainError(422, 'callback_amount_mismatch');
    }

    if (fundingTransaction.status !== 'pending') {
      if (fundingTransaction.status === status) {
        return { transaction: fundingTransaction, applied: false };
      }
      throw new DomainError(409, 'invalid_funding_state_transition');
    }

    if (status === 'failed') {
      await fundingTransaction.update({ status: 'failed' }, { transaction });
      return { transaction: fundingTransaction, applied: true };
    }

    const wallet = await lockedWalletForMember(fundingTransaction.memberId, transaction);
    const amount = dec(fundingTransaction.amount);
    const updatedBalance = dec(wallet.balance).plus(amount);
    const updatedRequiredTurnover = dec(wallet.turnoverRequired).plus(
      amount.times(String(fundingTransaction.turnoverMultiplier)),
    );

    await wallet.update(
      {
        balance: moneyString(updatedBalance),
        turnoverRequired: moneyString(updatedRequiredTurnover),
      },
      { transaction },
    );
    await WalletTransaction.create(
      {
        walletId: wallet.id,
        fundingTransactionId: fundingTransaction.id,
        type: 'deposit',
        amount: moneyString(amount),
      },
      { transaction },
    );
    await fundingTransaction.update({ status: 'completed' }, { transaction });
    return { transaction: fundingTransaction, applied: true };
  });
}

/** Debits a wager and increments turnover while holding the wallet row lock. */
export async function recordWager(walletId: string, amountInput: string): Promise<Wallet> {
  const amount = positiveMoney(amountInput);

  return sequelize.transaction(async (transaction) => {
    const wallet = await lockedWallet(walletId, transaction);
    const balance = dec(wallet.balance);
    if (balance.lt(amount)) {
      throw new DomainError(422, 'insufficient_balance');
    }

    const updatedBalance = balance.minus(amount);
    const updatedAccruedTurnover = dec(wallet.turnoverAccrued).plus(amount);
    await wallet.update(
      {
        balance: moneyString(updatedBalance),
        turnoverAccrued: moneyString(updatedAccruedTurnover),
      },
      { transaction },
    );
    await WalletTransaction.create(
      {
        walletId: wallet.id,
        type: 'wager',
        amount: moneyString(amount.negated()),
      },
      { transaction },
    );
    return wallet;
  });
}

/**
 * Locks turnover and balance together, then records an immediate withdrawal
 * debit plus its pending funding transaction in one atomic database change.
 */
export async function createWithdrawal(memberId: string, amountInput: string): Promise<{
  transaction: FundingTransaction;
  wallet: Wallet;
}> {
  const amount = positiveMoney(amountInput);

  return sequelize.transaction(async (transaction) => {
    const wallet = await lockedWalletForMember(memberId, transaction);
    const outstanding = withdrawalOutstanding(wallet);
    if (outstanding.gt(ZERO)) {
      throw new DomainError(422, 'turnover_requirement_not_met', {
        outstandingTurnover: moneyString(outstanding),
      });
    }

    const balance = dec(wallet.balance);
    if (balance.lt(amount)) {
      throw new DomainError(422, 'insufficient_balance');
    }

    const fundingTransaction = await FundingTransaction.create(
      {
        memberId,
        type: 'withdrawal',
        status: 'pending',
        amount: moneyString(amount),
        pspRef: null,
        turnoverMultiplier: 0,
      },
      { transaction },
    );
    await wallet.update({ balance: moneyString(balance.minus(amount)) }, { transaction });
    await WalletTransaction.create(
      {
        walletId: wallet.id,
        fundingTransactionId: fundingTransaction.id,
        type: 'withdrawal',
        amount: moneyString(amount.negated()),
      },
      { transaction },
    );
    return { transaction: fundingTransaction, wallet };
  });
}
