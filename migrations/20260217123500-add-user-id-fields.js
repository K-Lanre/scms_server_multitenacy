'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('Users', 'idType', {
            type: Sequelize.STRING,
            allowNull: true
        });
        await queryInterface.addColumn('Users', 'idNumber', {
            type: Sequelize.STRING,
            allowNull: true
        });
        await queryInterface.addColumn('Users', 'idImage', {
            type: Sequelize.STRING,
            allowNull: true
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('Users', 'idType');
        await queryInterface.removeColumn('Users', 'idNumber');
        await queryInterface.removeColumn('Users', 'idImage');
    }
};
