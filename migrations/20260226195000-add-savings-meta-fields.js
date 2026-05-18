'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Add minDeposit to SavingsProducts
        await queryInterface.addColumn('SavingsProducts', 'minDeposit', {
            type: Sequelize.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00,
            after: 'interestRate'
        });

        // Add withdrawalRequestedAt to UserSavingsPlans
        await queryInterface.addColumn('UserSavingsPlans', 'withdrawalRequestedAt', {
            type: Sequelize.DATE,
            allowNull: true,
            after: 'status'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('SavingsProducts', 'minDeposit');
        await queryInterface.removeColumn('UserSavingsPlans', 'withdrawalRequestedAt');
    }
};
