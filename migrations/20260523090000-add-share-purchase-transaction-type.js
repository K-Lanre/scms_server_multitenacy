'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Transactions_transactionType" ADD VALUE IF NOT EXISTS 'share_purchase';
    `);
  },

  down: async () => {
    console.log('Cannot remove PostgreSQL enum value: share_purchase');
  }
};
