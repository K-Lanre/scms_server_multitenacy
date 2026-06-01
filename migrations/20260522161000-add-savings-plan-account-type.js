'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Transactions_transactionType" ADD VALUE 'share_purchase';
    `);
    console.log('✅ Added share_purchase to Transactions transactionType enum');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('⚠️  Cannot remove enum value from PostgreSQL enum type');
  }
};