'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('funding_transactions', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'members', key: 'id' },
      },
      type: { type: Sequelize.STRING(16), allowNull: false },
      status: { type: Sequelize.STRING(16), allowNull: false },
      amount: { type: Sequelize.DECIMAL(36, 18), allowNull: false },
      psp_ref: { type: Sequelize.STRING(128), allowNull: true, unique: true },
      turnover_multiplier: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE funding_transactions
        ADD CONSTRAINT funding_transactions_type_check CHECK (type IN ('deposit', 'withdrawal')),
        ADD CONSTRAINT funding_transactions_status_check CHECK (status IN ('pending', 'completed', 'failed')),
        ADD CONSTRAINT funding_transactions_amount_check CHECK (amount > 0),
        ADD CONSTRAINT funding_transactions_multiplier_check CHECK (turnover_multiplier >= 0)
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('funding_transactions');
  },
};
