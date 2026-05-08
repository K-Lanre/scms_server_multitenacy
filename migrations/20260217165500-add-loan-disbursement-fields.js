'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Add bank details to Users
        await queryInterface.addColumn('Users', 'bankName', {
            type: Sequelize.STRING,
            allowNull: true
        });
        await queryInterface.addColumn('Users', 'accountNumber', {
            type: Sequelize.STRING,
            allowNull: true
        });

        // Add disbursement details to Loans
        await queryInterface.addColumn('Loans', 'paystackTransferRecipient', {
            type: Sequelize.STRING,
            allowNull: true
        });
        await queryInterface.addColumn('Loans', 'disbursementReference', {
            type: Sequelize.STRING,
            allowNull: true
        });
        await queryInterface.addColumn('Loans', 'bankName', {
            type: Sequelize.STRING,
            allowNull: true
        });
        await queryInterface.addColumn('Loans', 'accountNumber', {
            type: Sequelize.STRING,
            allowNull: true
        });
    },

    async down(queryInterface, Sequelize) {
        // Remove columns from Users
        await queryInterface.removeColumn('Users', 'bankName');
        await queryInterface.removeColumn('Users', 'accountNumber');

        // Remove columns from Loans
        await queryInterface.removeColumn('Loans', 'paystackTransferRecipient');
        await queryInterface.removeColumn('Loans', 'disbursementReference');
        await queryInterface.removeColumn('Loans', 'bankName');
        await queryInterface.removeColumn('Loans', 'accountNumber');
    }
};
