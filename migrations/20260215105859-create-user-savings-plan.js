'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('UserSavingsPlans', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      productId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'SavingsProducts',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      accountId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Accounts',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      targetAmount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      startDate: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      maturityDate: {
        type: Sequelize.DATE,
        allowNull: false
      },
      autoSaveAmount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      frequency: {
        type: Sequelize.ENUM('daily', 'weekly', 'monthly', 'manual'),
        allowNull: false,
        defaultValue: 'manual'
      },
      status: {
        type: Sequelize.ENUM('active', 'completed', 'defaulted', 'liquidated'),
        defaultValue: 'active'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('UserSavingsPlans', ['userId']);
    await queryInterface.addIndex('UserSavingsPlans', ['productId']);
    await queryInterface.addIndex('UserSavingsPlans', ['status']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('UserSavingsPlans');
  }
};