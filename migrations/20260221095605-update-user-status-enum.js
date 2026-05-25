'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // This migration is no longer needed since the Users table already has the correct ENUM
    // Skip this migration
    console.log('Skipping migration - Users table already has correct status ENUM');
  },

  down: async (queryInterface, Sequelize) => {
    // No-op
    console.log('Skipping down migration');
  }
};
