'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // In MySQL, to update an ENUM, you have to run an ALTER TABLE query
    return queryInterface.sequelize.query(`
      ALTER TABLE Users MODIFY COLUMN status ENUM('active', 'inactive', 'suspended', 'pending_onboarding', 'pending_approval') DEFAULT 'pending_onboarding';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(`
      ALTER TABLE Users MODIFY COLUMN status ENUM('active', 'inactive', 'suspended') DEFAULT 'active';
    `);
  }
};
