'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('UserSavingsPlans', 'planName', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'accountId',
      comment: 'Personalized name given to the plan by the user'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('UserSavingsPlans', 'planName');
  }
};
