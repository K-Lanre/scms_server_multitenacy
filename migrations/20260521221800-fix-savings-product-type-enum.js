'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Fix the SavingsProducts type enum to include 'safebox'
    // PostgreSQL requires raw SQL to properly modify ENUMs
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_SavingsProducts_type" ADD VALUE IF NOT EXISTS 'safebox';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Note: Removing ENUM values is not directly supported in PostgreSQL
    // This would require recreating the type, which is complex
    console.log('Warning: Cannot remove ENUM value in PostgreSQL down migration');
  }
};
