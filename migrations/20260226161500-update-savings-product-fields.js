'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // 1. Update 'type' ENUM to include 'safebox'
        // Note: Some databases might require raw SQL to update ENUMs
        await queryInterface.changeColumn('SavingsProducts', 'type', {
            type: Sequelize.ENUM('fixed', 'target', 'safebox'),
            allowNull: false
        });

        // 2. Add 'category' ENUM
        await queryInterface.addColumn('SavingsProducts', 'category', {
            type: Sequelize.ENUM('none', 'rent', 'education', 'business', 'emergency', 'festive'),
            defaultValue: 'none',
            allowNull: false
        });

        // 3. Add 'isQuickSaving' boolean
        await queryInterface.addColumn('SavingsProducts', 'isQuickSaving', {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
            allowNull: false
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('SavingsProducts', 'isQuickSaving');
        await queryInterface.removeColumn('SavingsProducts', 'category');
        await queryInterface.changeColumn('SavingsProducts', 'type', {
            type: Sequelize.ENUM('fixed', 'target'),
            allowNull: false
        });
    }
};
