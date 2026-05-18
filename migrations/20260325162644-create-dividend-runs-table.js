'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('DividendRuns', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      year: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      totalSurplus: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      totalShares: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      dividendPerShare: {
        type: Sequelize.DECIMAL(15, 6),
        allowNull: false
      },
      totalDistributed: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      memberCount: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('draft', 'completed', 'reversed'),
        defaultValue: 'completed'
      },
      performedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
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
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('DividendRuns');
  }
};
