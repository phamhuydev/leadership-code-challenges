import { DataTypes, Model, Sequelize } from 'sequelize';

export type WalletTransactionType = 'deposit' | 'wager' | 'withdrawal';

/**
 * Append-only balance ledger. `amount` is signed, so summing all entries for
 * a wallet produces its balance without trusting the materialized balance.
 */
export class WalletTransaction extends Model {
  declare id: string;
  declare walletId: string;
  declare fundingTransactionId: string | null;
  declare type: WalletTransactionType;
  declare amount: string;
}

export function initWalletTransaction(sequelize: Sequelize): void {
  WalletTransaction.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      walletId: { type: DataTypes.UUID, allowNull: false },
      fundingTransactionId: { type: DataTypes.UUID, allowNull: true },
      type: { type: DataTypes.STRING(16), allowNull: false },
      amount: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
    },
    { sequelize, tableName: 'wallet_txs', underscored: true, updatedAt: false },
  );
}
