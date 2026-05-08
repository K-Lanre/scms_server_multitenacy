'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('Transactions');

        // 1. Add linkedTransactionId if missing
        if (!tableInfo.linkedTransactionId) {
            await queryInterface.addColumn('Transactions', 'linkedTransactionId', {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'Transactions',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
                comment: 'Links paired transactions (e.g., transfer_out <-> transfer_in)'
            });

            // Add index for faster lookups
            await queryInterface.addIndex('Transactions', ['linkedTransactionId'], {
                name: 'transactions_linked_transaction_idx'
            });
        }

        // 2. Add purpose if missing
        if (!tableInfo.purpose) {
            await queryInterface.addColumn('Transactions', 'purpose', {
                type: Sequelize.ENUM(
                    'debt_repayment',
                    'family_support',
                    'contribution',
                    'business',
                    'savings',
                    'other',
                    'account_transfer'
                ),
                allowNull: true,
                comment: 'Purpose of the transaction for auditing and reporting'
            });

            // Add index for purpose filtering
            await queryInterface.addIndex('Transactions', ['purpose'], {
                name: 'transactions_purpose_idx'
            });
        }
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeIndex('Transactions', 'transactions_linked_transaction_idx');
        await queryInterface.removeIndex('Transactions', 'transactions_purpose_idx');
        await queryInterface.removeColumn('Transactions', 'linkedTransactionId');
        await queryInterface.removeColumn('Transactions', 'purpose');
    }
};
