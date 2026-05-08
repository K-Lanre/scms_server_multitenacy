'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Backfill completedAt for existing completed loans
    // Use lastDeductionDate if available, otherwise use updatedAt
    await queryInterface.sequelize.query(`
      UPDATE Loans 
      SET completedAt = COALESCE(lastDeductionDate, updatedAt)
      WHERE status = 'completed' AND completedAt IS NULL
    `);
  },

  async down(queryInterface, Sequelize) {
    // No need to revert - we don't want to lose the data
  }
};
