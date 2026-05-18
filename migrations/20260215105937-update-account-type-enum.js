'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Modify the ENUM column to include 'savings_plan'
    await queryInterface.changeColumn('Accounts', 'accountType', {
      type: Sequelize.ENUM('savings', 'share_capital', 'savings_plan'),
      allowNull: false,
      defaultValue: 'savings'
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert the ENUM column to original values
    // WARNING: This might fail if there are records with 'savings_plan'
    await queryInterface.changeColumn('Accounts', 'accountType', {
      type: Sequelize.ENUM('savings', 'share_capital'),
      allowNull: false,
      defaultValue: 'savings'
    });
  }
};
