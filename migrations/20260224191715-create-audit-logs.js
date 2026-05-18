'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AuditLogs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      action: {
        type: Sequelize.STRING,
        allowNull: false
      },
      details: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      ipAddress: {
        type: Sequelize.STRING,
        allowNull: true
      },
      userAgent: {
        type: Sequelize.STRING,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.addIndex('AuditLogs', ['userId']);
    await queryInterface.addIndex('AuditLogs', ['action']);
    await queryInterface.addIndex('AuditLogs', ['createdAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('AuditLogs');
  }
};
