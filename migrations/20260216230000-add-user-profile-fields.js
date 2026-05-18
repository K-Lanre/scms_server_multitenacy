'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('Users', 'phoneNumber', {
            type: Sequelize.STRING,
            allowNull: true
        });
        await queryInterface.addColumn('Users', 'address', {
            type: Sequelize.STRING,
            allowNull: true
        });
        await queryInterface.addColumn('Users', 'state', {
            type: Sequelize.STRING,
            allowNull: true
        });
        await queryInterface.addColumn('Users', 'lga', {
            type: Sequelize.STRING,
            allowNull: true
        });
        await queryInterface.addColumn('Users', 'dateOfBirth', {
            type: Sequelize.DATEONLY,
            allowNull: true
        });
        await queryInterface.addColumn('Users', 'nextOfKinName', {
            type: Sequelize.STRING,
            allowNull: true
        });
        await queryInterface.addColumn('Users', 'nextOfKinPhone', {
            type: Sequelize.STRING,
            allowNull: true
        });
        await queryInterface.addColumn('Users', 'nextOfKinRelationship', {
            type: Sequelize.STRING,
            allowNull: true
        });
        await queryInterface.addColumn('Users', 'profilePicture', {
            type: Sequelize.STRING,
            allowNull: true
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('Users', 'phoneNumber');
        await queryInterface.removeColumn('Users', 'address');
        await queryInterface.removeColumn('Users', 'state');
        await queryInterface.removeColumn('Users', 'lga');
        await queryInterface.removeColumn('Users', 'dateOfBirth');
        await queryInterface.removeColumn('Users', 'nextOfKinName');
        await queryInterface.removeColumn('Users', 'nextOfKinPhone');
        await queryInterface.removeColumn('Users', 'nextOfKinRelationship');
        await queryInterface.removeColumn('Users', 'profilePicture');
    }
};
