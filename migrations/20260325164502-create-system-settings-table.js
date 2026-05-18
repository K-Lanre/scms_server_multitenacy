'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SystemSettings', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      key: {
        type: Sequelize.STRING,
        allowNull: false
      },
      value: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true
      },
      type: {
        type: Sequelize.ENUM('string', 'number', 'boolean', 'json'),
        defaultValue: 'string'
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

    // Seed default monthly thrift amount
    await queryInterface.bulkInsert('SystemSettings', [{
      key: 'monthly_thrift_amount',
      value: '5000',
      description: 'Minimum required monthly thrift contribution',
      type: 'number',
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('SystemSettings');
  }
};
