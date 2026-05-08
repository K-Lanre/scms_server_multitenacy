'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('SystemSettings', [{
      key: 'loan_interest_tiers',
      value: JSON.stringify([
        { minMonths: 1, maxMonths: 3, rate: 5 },
        { minMonths: 4, maxMonths: 6, rate: 8 },
        { minMonths: 7, maxMonths: 12, rate: 10 },
        { minMonths: 13, maxMonths: 24, rate: 12 },
        { minMonths: 25, maxMonths: 36, rate: 15 }
      ]),
      description: 'Monthly loan interest tiers as periodic APR ranges',
      type: 'json',
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('SystemSettings', { key: 'loan_interest_tiers' });
  }
};
