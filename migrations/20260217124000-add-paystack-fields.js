'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Update Users table
        await queryInterface.addColumn('Users', 'paystackCustomerCode', {
            type: Sequelize.STRING,
            allowNull: true
        });

        // Update Accounts table
        await queryInterface.addColumn('Accounts', 'paystackChannel', {
            type: Sequelize.STRING,
            allowNull: true
        });
        await queryInterface.addColumn('Accounts', 'paystackDedicatedAccountNumber', {
            type: Sequelize.STRING,
            allowNull: true
        });
        await queryInterface.addColumn('Accounts', 'paystackDedicatedAccountBank', {
            type: Sequelize.STRING,
            allowNull: true
        });
        await queryInterface.addColumn('Accounts', 'paystackDedicatedAccountName', {
            type: Sequelize.STRING,
            allowNull: true
        });
        await queryInterface.addColumn('Accounts', 'paystackAssignmentReference', {
            type: Sequelize.STRING,
            allowNull: true
        });
    },

    async down(queryInterface, Sequelize) {
        // Revert Users table
        await queryInterface.removeColumn('Users', 'paystackCustomerCode');

        // Revert Accounts table
        await queryInterface.removeColumn('Accounts', 'paystackChannel');
        await queryInterface.removeColumn('Accounts', 'paystackDedicatedAccountNumber');
        await queryInterface.removeColumn('Accounts', 'paystackDedicatedAccountBank');
        await queryInterface.removeColumn('Accounts', 'paystackDedicatedAccountName');
        await queryInterface.removeColumn('Accounts', 'paystackAssignmentReference');
    }
};
