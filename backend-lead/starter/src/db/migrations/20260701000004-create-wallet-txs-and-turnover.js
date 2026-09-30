'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('wallets', 'turnover_required', {
      type: Sequelize.DECIMAL(36, 18),
      allowNull: false,
      defaultValue: '0',
    });
    await queryInterface.addColumn('wallets', 'turnover_accrued', {
      type: Sequelize.DECIMAL(36, 18),
      allowNull: false,
      defaultValue: '0',
    });
    await queryInterface.createTable('wallet_txs', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      wallet_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'wallets', key: 'id' },
      },
      funding_transaction_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'funding_transactions', key: 'id' },
      },
      type: { type: Sequelize.STRING(16), allowNull: false },
      amount: { type: Sequelize.DECIMAL(36, 18), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE wallets
        ADD CONSTRAINT wallets_turnover_required_check CHECK (turnover_required >= 0),
        ADD CONSTRAINT wallets_turnover_accrued_check CHECK (turnover_accrued >= 0);
      ALTER TABLE wallet_txs
        ADD CONSTRAINT wallet_txs_type_check CHECK (type IN ('deposit', 'wager', 'withdrawal')),
        ADD CONSTRAINT wallet_txs_amount_check CHECK (amount <> 0);
      CREATE UNIQUE INDEX wallet_txs_funding_transaction_id_unique
        ON wallet_txs (funding_transaction_id)
        WHERE funding_transaction_id IS NOT NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('wallet_txs');
    await queryInterface.removeColumn('wallets', 'turnover_accrued');
    await queryInterface.removeColumn('wallets', 'turnover_required');
  },
};
