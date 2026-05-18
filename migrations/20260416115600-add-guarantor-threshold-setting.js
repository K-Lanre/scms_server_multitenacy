'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('SystemSettings', [{
      key: 'loan_guarantor_threshold',
      value: '25',
      description: 'Minimum percentage of the loan amount a guarantor must hold in their savings balance.',
      type: 'number',
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('SystemSettings', { key: 'loan_guarantor_threshold' });
  }
};
