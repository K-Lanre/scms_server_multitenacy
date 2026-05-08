'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Contributions', {
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
        onDelete: 'CASCADE'
      },
      month: {
        type: Sequelize.STRING, // format: YYYY-MM
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'paid', 'defaulted', 'failed_insufficient'),
        defaultValue: 'pending'
      },
      type: {
        type: Sequelize.ENUM('thrift', 'commission'),
        defaultValue: 'thrift',
        allowNull: false
      },
      collectionMethod: {
        type: Sequelize.ENUM('automatic', 'cash', 'manual_internal'),
        allowNull: true
      },
      institutionId: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      paidAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      transactionId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Transactions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add unique index to prevent multiple contributions for same user/month/type
    await queryInterface.addIndex('Contributions', ['userId', 'month', 'type'], {
      unique: true
    });
    await queryInterface.addIndex('Contributions', ['institutionId']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Contributions');
  }
};
