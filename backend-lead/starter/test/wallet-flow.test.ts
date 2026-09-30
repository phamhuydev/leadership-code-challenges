import request from 'supertest';
import { createApp } from '../src/app';
import { FundingTransaction, Wallet, WalletTransaction } from '../src/db/models';
import { sequelize } from '../src/db/sequelize';

const app = createApp();
const HUNDRED = '100.000000000000000000';

async function createMember(username: string): Promise<{ memberId: string; walletId: string }> {
  const response = await request(app).post('/members').send({ username });
  expect(response.status).toBe(201);
  return { memberId: response.body.member.id, walletId: response.body.wallet.id };
}

async function createDeposit(memberId: string, amount = '100.00', turnoverMultiplier = 1) {
  const response = await request(app)
    .post('/deposits')
    .send({ memberId, amount, turnoverMultiplier });
  expect(response.status).toBe(201);
  return response.body as { id: string; pspRef: string };
}

async function completeDeposit(pspRef: string, amount = '100.00') {
  return request(app).post('/psp/callbacks').send({ pspRef, status: 'completed', amount });
}

beforeAll(async () => {
  await sequelize.authenticate();
});

beforeEach(async () => {
  await sequelize.truncate({ cascade: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('PSP callbacks', () => {
  it('credits a sequential duplicate callback exactly once', async () => {
    const { memberId, walletId } = await createMember('callback-sequential');
    const deposit = await createDeposit(memberId);

    const first = await completeDeposit(deposit.pspRef);
    const retry = await completeDeposit(deposit.pspRef);

    expect(first.status).toBe(200);
    expect(first.body.applied).toBe(true);
    expect(retry.status).toBe(200);
    expect(retry.body.applied).toBe(false);

    const wallet = await Wallet.findByPk(walletId);
    expect(wallet?.balance).toBe(HUNDRED);
    expect(await WalletTransaction.count({ where: { walletId } })).toBe(1);
  });

  it('credits concurrent duplicate callbacks exactly once', async () => {
    const { memberId, walletId } = await createMember('callback-concurrent');
    const deposit = await createDeposit(memberId);

    const callbacks = await Promise.all([
      completeDeposit(deposit.pspRef),
      completeDeposit(deposit.pspRef),
    ]);

    expect(callbacks.map((response) => response.status)).toEqual([200, 200]);
    expect(callbacks.filter((response) => response.body.applied).length).toBe(1);

    const [wallet, transaction, ledgerEntries] = await Promise.all([
      Wallet.findByPk(walletId),
      FundingTransaction.findByPk(deposit.id),
      WalletTransaction.count({ where: { walletId } }),
    ]);
    expect(wallet?.balance).toBe(HUNDRED);
    expect(transaction?.status).toBe('completed');
    expect(ledgerEntries).toBe(1);
  });
});

describe('wagers and withdrawals', () => {
  it('does not let concurrent wagers overdraw a wallet', async () => {
    const { memberId, walletId } = await createMember('wager-concurrent');
    const deposit = await createDeposit(memberId);
    expect((await completeDeposit(deposit.pspRef)).status).toBe(200);

    const wagers = await Promise.all([
      request(app).post(`/wallets/${walletId}/wagers`).send({ amount: '70.00' }),
      request(app).post(`/wallets/${walletId}/wagers`).send({ amount: '70.00' }),
    ]);

    expect(wagers.map((response) => response.status).sort()).toEqual([201, 422]);
    const wallet = await Wallet.findByPk(walletId);
    expect(wallet?.balance).toBe('30.000000000000000000');
    expect(await WalletTransaction.count({ where: { walletId, type: 'wager' } })).toBe(1);
  });

  it('blocks a withdrawal until the required turnover is accrued', async () => {
    const { memberId, walletId } = await createMember('turnover-lock');
    const lockedDeposit = await createDeposit(memberId, '100.00', 1);
    const unrestrictedDeposit = await createDeposit(memberId, '100.00', 0);
    await completeDeposit(lockedDeposit.pspRef);
    await completeDeposit(unrestrictedDeposit.pspRef);

    const blocked = await request(app).post('/withdrawals').send({ memberId, amount: '50.00' });
    expect(blocked.status).toBe(422);
    expect(blocked.body).toMatchObject({
      error: 'turnover_requirement_not_met',
      outstandingTurnover: HUNDRED,
    });

    const wager = await request(app).post(`/wallets/${walletId}/wagers`).send({ amount: '100.00' });
    expect(wager.status).toBe(201);

    const withdrawal = await request(app).post('/withdrawals').send({ memberId, amount: '50.00' });
    expect(withdrawal.status).toBe(201);
    expect(withdrawal.body.status).toBe('pending');

    const wallet = await Wallet.findByPk(walletId);
    expect(wallet?.balance).toBe('50.000000000000000000');
    expect(wallet?.turnoverRequired).toBe(HUNDRED);
    expect(wallet?.turnoverAccrued).toBe(HUNDRED);
  });
});
