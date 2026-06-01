'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // 1. Modify the ENUM column to include 'institution_admin'
        await queryInterface.changeColumn('Users', 'role', {
            type: Sequelize.ENUM('super_admin', 'institution_admin', 'staff', 'member', 'user'),
            allowNull: false,
            defaultValue: 'user'
        });

        // 2. Update existing users with role 'admin' to 'institution_admin'
        // This handles the transition from old 'admin' role to new 'institution_admin' role
        // Skip if no users have 'admin' role (it might not exist)
        try {
            await queryInterface.sequelize.query(
                `UPDATE "Users" SET "role" = 'institution_admin' WHERE "role" = 'admin'`
            );
        } catch (error) {
            console.log('No users with admin role to update, skipping...');
        }
    },

    async down(queryInterface, Sequelize) {
        // 1. Revert 'institution_admin' users back to 'admin' (if they existed)
        try {
            await queryInterface.sequelize.query(
                `UPDATE "Users" SET "role" = 'admin' WHERE "role" = 'institution_admin'`
            );
        } catch (error) {
            console.log('No users with institution_admin role to revert, skipping...');
        }

        // 2. Revert the ENUM column to original values (without 'institution_admin')
        await queryInterface.changeColumn('Users', 'role', {
            type: Sequelize.ENUM('super_admin', 'staff', 'member', 'user'),
            allowNull: false,
            defaultValue: 'user'
        });
    }
};
