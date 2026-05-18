'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('LoanGuarantors', 'isDismissed', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('LoanGuarantors', 'isDismissed');
  }
};
