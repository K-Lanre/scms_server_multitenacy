'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('PostingLogs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      type: {
        type: Sequelize.ENUM('interest', 'dividend'),
        allowNull: false
      },
      period: {
        type: Sequelize.STRING,
        allowNull: false
      },
      rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false
      },
      totalAmount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      beneficiaryCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      status: {
        type: Sequelize.ENUM('proposed', 'completed', 'failed', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'proposed'
      },
      performedBy: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      completedAt: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex('PostingLogs', ['type', 'period'], {
      unique: true,
      name: 'posting_logs_type_period_unique'
    });
    
    await queryInterface.addIndex('PostingLogs', ['status']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('PostingLogs');
  }
};
