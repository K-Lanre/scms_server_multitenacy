'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Loans', 'loanType', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'userId'
    });
    await queryInterface.addColumn('Loans', 'loanPurpose', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'loanType'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Loans', 'loanType');
    await queryInterface.removeColumn('Loans', 'loanPurpose');
  }
};
