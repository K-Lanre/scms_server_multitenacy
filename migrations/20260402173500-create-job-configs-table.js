'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('JobConfigs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      jobId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      cronExpression: {
        type: Sequelize.STRING,
        allowNull: false
      },
      isEnabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      isSystem: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      lastRunAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      lastRunStatus: {
        type: Sequelize.ENUM('success', 'failed', 'running'),
        allowNull: true
      },
      category: {
        type: Sequelize.STRING,
        allowNull: true
      },
      performedBy: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('JobConfigs');
  }
};
