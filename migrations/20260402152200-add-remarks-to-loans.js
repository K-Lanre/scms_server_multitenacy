'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Loans', 'remarks', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Rejection or review remarks'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Loans', 'remarks');
  }
};
