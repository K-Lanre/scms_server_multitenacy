'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Loans', 'completedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Loans', 'completedAt');
  }
};
