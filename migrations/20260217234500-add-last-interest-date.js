'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('UserSavingsPlans', 'lastInterestDate', {
            type: Sequelize.DATE,
            allowNull: true,
            after: 'maturityDate'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('UserSavingsPlans', 'lastInterestDate');
    }
};
