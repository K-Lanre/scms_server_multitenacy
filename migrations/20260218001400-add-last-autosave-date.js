'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('UserSavingsPlans', 'lastAutoSaveDate', {
            type: Sequelize.DATE,
            allowNull: true,
            after: 'lastInterestDate'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('UserSavingsPlans', 'lastAutoSaveDate');
    }
};
