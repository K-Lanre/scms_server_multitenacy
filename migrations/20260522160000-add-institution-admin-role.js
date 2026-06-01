'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Users_role" ADD VALUE 'institution_admin';
    `);
    console.log('✅ Added institution_admin to Users role enum');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('⚠️  Cannot remove enum value from PostgreSQL enum type');
  }
};