'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('Loans', 'repaymentMode', {
            type: Sequelize.ENUM('manual', 'automated'),
            defaultValue: 'manual',
            allowNull: false,
            after: 'accountNumber'
        });

        await queryInterface.addColumn('Loans', 'monthlyDeductionAmount', {
            type: Sequelize.DECIMAL(15, 2),
            allowNull: true,
            after: 'repaymentMode'
        });

        await queryInterface.addColumn('Loans', 'dueDate', {
            type: Sequelize.DATE,
            allowNull: true,
            after: 'monthlyDeductionAmount'
        });

        await queryInterface.addColumn('Loans', 'originalDueDate', {
            type: Sequelize.DATE,
            allowNull: true,
            after: 'dueDate'
        });

        await queryInterface.addColumn('Loans', 'lastDeductionDate', {
            type: Sequelize.DATE,
            allowNull: true,
            after: 'originalDueDate'
        });

        await queryInterface.addColumn('Loans', 'failedDeductionCount', {
            type: Sequelize.INTEGER,
            defaultValue: 0,
            allowNull: false,
            after: 'lastDeductionDate'
        });

        await queryInterface.addColumn('Loans', 'extensionCount', {
            type: Sequelize.INTEGER,
            defaultValue: 0,
            allowNull: false,
            after: 'failedDeductionCount'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('Loans', 'repaymentMode');
        await queryInterface.removeColumn('Loans', 'monthlyDeductionAmount');
        await queryInterface.removeColumn('Loans', 'dueDate');
        await queryInterface.removeColumn('Loans', 'originalDueDate');
        await queryInterface.removeColumn('Loans', 'lastDeductionDate');
        await queryInterface.removeColumn('Loans', 'failedDeductionCount');
        await queryInterface.removeColumn('Loans', 'extensionCount');
    }
};
