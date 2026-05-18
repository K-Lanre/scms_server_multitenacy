'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Accounts', {
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
      accountNumber: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true
      },
      accountType: {
        type: Sequelize.ENUM('savings', 'share_capital'),
        allowNull: false,
        defaultValue: 'savings'
      },
      balance: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      status: {
        type: Sequelize.ENUM('active', 'frozen', 'closed'),
        allowNull: false,
        defaultValue: 'active'
      },
      openedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      closedAt: {
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
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('Accounts', ['userId']);
    await queryInterface.addIndex('Accounts', ['status']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Accounts');
  }
};
