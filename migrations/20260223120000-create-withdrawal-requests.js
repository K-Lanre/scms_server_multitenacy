'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('WithdrawalRequests', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            userId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT'
            },
            accountId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'accounts',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT'
            },
            amount: {
                type: Sequelize.DECIMAL(15, 2),
                allowNull: false
            },
            status: {
                type: Sequelize.ENUM('pending', 'approved', 'rejected', 'cancelled'),
                defaultValue: 'pending',
                allowNull: false
            },
            reason: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            rejectionReason: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            processedBy: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            processedAt: {
                type: Sequelize.DATE,
                allowNull: true
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE
            }
        });
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('WithdrawalRequests');
    }
};
