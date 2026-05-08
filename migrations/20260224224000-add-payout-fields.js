'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Add bankCode and paystackRecipientCode to Users table
        await queryInterface.addColumn('Users', 'bankCode', {
            type: Sequelize.STRING,
            allowNull: true
        });
        await queryInterface.addColumn('Users', 'paystackRecipientCode', {
            type: Sequelize.STRING,
            allowNull: true
        });

        // Add paystackTransferReference to WithdrawalRequests table
        await queryInterface.addColumn('WithdrawalRequests', 'paystackTransferReference', {
            type: Sequelize.STRING,
            allowNull: true
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('Users', 'bankCode');
        await queryInterface.removeColumn('Users', 'paystackRecipientCode');
        await queryInterface.removeColumn('WithdrawalRequests', 'paystackTransferReference');
    }
};
