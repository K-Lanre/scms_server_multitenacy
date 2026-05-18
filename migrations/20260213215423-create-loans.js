'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Loans', {
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
      loanAmount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      interestRate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      monthlyPayment: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      totalRepayable: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      outstandingBalance: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'disbursed', 'repaying', 'completed', 'defaulted', 'rejected'),
        defaultValue: 'pending'
      },
      approvedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      disbursedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      nextPaymentDate: {
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

    await queryInterface.addIndex('Loans', ['userId']);
    await queryInterface.addIndex('Loans', ['status']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Loans');
  }
};
