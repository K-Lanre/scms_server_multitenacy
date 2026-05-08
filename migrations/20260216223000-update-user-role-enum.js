'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Modify the ENUM column to include 'user'
        await queryInterface.changeColumn('Users', 'role', {
            type: Sequelize.ENUM('super_admin', 'staff', 'member', 'user'),
            allowNull: false,
            defaultValue: 'user'
        });
    },

    async down(queryInterface, Sequelize) {
        // Revert the ENUM column to original values
        // WARNING: This might fail if there are records with 'user'
        await queryInterface.changeColumn('Users', 'role', {
            type: Sequelize.ENUM('super_admin', 'staff', 'member'),
            allowNull: false,
            defaultValue: 'member'
        });
    }
};
