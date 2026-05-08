'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('WithdrawalRequests', 'recipientName', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('WithdrawalRequests', 'recipientAccount', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('WithdrawalRequests', 'recipientBank', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('WithdrawalRequests', 'isExternalTransfer', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('WithdrawalRequests', 'recipientName');
    await queryInterface.removeColumn('WithdrawalRequests', 'recipientAccount');
    await queryInterface.removeColumn('WithdrawalRequests', 'recipientBank');
    await queryInterface.removeColumn('WithdrawalRequests', 'isExternalTransfer');
  }
};
