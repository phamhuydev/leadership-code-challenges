import { DataTypes, Model, Sequelize } from 'sequelize';

export type FundingTransactionType = 'deposit' | 'withdrawal';
export type FundingTransactionStatus = 'pending' | 'completed' | 'failed';

/** Records the lifecycle of money entering or leaving the platform. */
export class FundingTransaction extends Model {
  declare id: string;
  declare memberId: string;
  declare type: FundingTransactionType;
  declare status: FundingTransactionStatus;
  declare amount: string;
  declare pspRef: string | null;
  declare turnoverMultiplier: number;
}

export function initFundingTransaction(sequelize: Sequelize): void {
  FundingTransaction.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      memberId: { type: DataTypes.UUID, allowNull: false },
      type: { type: DataTypes.STRING(16), allowNull: false },
      status: { type: DataTypes.STRING(16), allowNull: false },
      amount: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      pspRef: { type: DataTypes.STRING(128), allowNull: true, unique: true },
      turnoverMultiplier: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    },
    { sequelize, tableName: 'funding_transactions', underscored: true },
  );
}
