'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Transactions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
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
      transactionType: {
        type: Sequelize.ENUM(
          'deposit',
          'withdrawal',
          'loan_disbursement',
          'loan_repayment',
          'interest',
          'dividend',
          'transfer_in',
          'transfer_out'
        ),
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      balanceAfter: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Account balance snapshot after this transaction'
      },
      reference: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      performedBy: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: 'Staff/admin who performed this transaction'
      },
      status: {
        type: Sequelize.ENUM('pending', 'completed', 'failed', 'reversed'),
        allowNull: false,
        defaultValue: 'completed'
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
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('Transactions', ['accountId']);
    await queryInterface.addIndex('Transactions', ['transactionType']);
    await queryInterface.addIndex('Transactions', ['status']);
    await queryInterface.addIndex('Transactions', ['createdAt']);
    await queryInterface.addIndex('Transactions', ['performedBy']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Transactions');
  }
};
