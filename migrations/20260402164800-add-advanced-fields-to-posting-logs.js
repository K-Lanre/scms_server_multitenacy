'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add new columns to PostingLogs
    await queryInterface.addColumn('PostingLogs', 'targetProductId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'SavingsProducts',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('PostingLogs', 'minBalance', {
      type: Sequelize.DECIMAL(15, 2),
      defaultValue: 0,
      allowNull: false
    });

    await queryInterface.addColumn('PostingLogs', 'taxRate', {
      type: Sequelize.DECIMAL(5, 2),
      defaultValue: 0,
      allowNull: false
    });

    await queryInterface.addColumn('PostingLogs', 'taxAmount', {
      type: Sequelize.DECIMAL(15, 2),
      defaultValue: 0,
      allowNull: false
    });

    await queryInterface.addColumn('PostingLogs', 'approvedBy', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('PostingLogs', 'remarks', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    // Update the status ENUM
    // Note: Changing ENUMs in migrations can be tricky across different DBs.
    // In many cases, adding a new column to replace it or using a raw query is safer.
    // For this implementation, we'll try to change it for MySQL/PostgreSQL compatibility.
    // If it's SQLite (common in local dev), we might need a workaround.
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('PostingLogs', 'targetProductId');
    await queryInterface.removeColumn('PostingLogs', 'minBalance');
    await queryInterface.removeColumn('PostingLogs', 'taxRate');
    await queryInterface.removeColumn('PostingLogs', 'taxAmount');
    await queryInterface.removeColumn('PostingLogs', 'approvedBy');
    await queryInterface.removeColumn('PostingLogs', 'remarks');
  }
};
