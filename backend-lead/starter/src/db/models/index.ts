import { sequelize } from '../sequelize';
import { Member, initMember } from './member';
import { Wallet, initWallet } from './wallet';
import { FundingTransaction, initFundingTransaction } from './fundingTransaction';
import { WalletTransaction, initWalletTransaction } from './walletTransaction';

initMember(sequelize);
initWallet(sequelize);
initFundingTransaction(sequelize);
initWalletTransaction(sequelize);

Member.hasOne(Wallet, { foreignKey: 'memberId', as: 'wallet' });
Wallet.belongsTo(Member, { foreignKey: 'memberId', as: 'member' });
Member.hasMany(FundingTransaction, { foreignKey: 'memberId', as: 'fundingTransactions' });
FundingTransaction.belongsTo(Member, { foreignKey: 'memberId', as: 'member' });
Wallet.hasMany(WalletTransaction, { foreignKey: 'walletId', as: 'transactions' });
WalletTransaction.belongsTo(Wallet, { foreignKey: 'walletId', as: 'wallet' });
FundingTransaction.hasMany(WalletTransaction, {
  foreignKey: 'fundingTransactionId',
  as: 'walletTransactions',
});
WalletTransaction.belongsTo(FundingTransaction, {
  foreignKey: 'fundingTransactionId',
  as: 'fundingTransaction',
});

export { Member, Wallet, FundingTransaction, WalletTransaction };
