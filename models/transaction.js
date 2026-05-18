const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Transaction = sequelize.define('Transaction', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        accountId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Accounts',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT'
        },
        institutionId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Institutions',
                key: 'id'
            }
        },
        transactionType: {
            type: DataTypes.ENUM(
                'deposit',
                'withdrawal',
                'loan_disbursement',
                'loan_repayment',
                'interest',
                'dividend',
                'transfer_in',
                'transfer_out',
                'share_purchase'
            ),
            allowNull: false
        },
        amount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            validate: {
                min: 0.01
            }
        },
        balanceAfter: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            comment: 'Account balance snapshot after this transaction'
        },
        reference: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        performedBy: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
            comment: 'Staff/admin who performed this transaction'
        },
        status: {
            type: DataTypes.ENUM('pending', 'completed', 'failed', 'reversed'),
            allowNull: false,
            defaultValue: 'completed'
        },
        completedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        linkedTransactionId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'Transactions',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
            comment: 'Links paired transactions (e.g., transfer_out <-> transfer_in)'
        },
        purpose: {
            type: DataTypes.ENUM(
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
        }
    }, {
        tableName: 'Transactions',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['reference']
            },
            {
                fields: ['transactionType']
            },
            {
                fields: ['status']
            },
            {
                fields: ['createdAt']
            }
        ]
    });

    Transaction.associate = (models) => {
        Transaction.belongsTo(models.Account, {
            foreignKey: 'accountId',
            as: 'account'
        });
        Transaction.belongsTo(models.User, {
            foreignKey: 'performedBy',
            as: 'performer'
        });
        Transaction.belongsTo(models.Institution, {
            foreignKey: 'institutionId',
            as: 'institution'
        });
        // Self-referential association for linked transactions
        Transaction.belongsTo(models.Transaction, {
            foreignKey: 'linkedTransactionId',
            as: 'linkedTransaction'
        });
        Transaction.hasOne(models.Transaction, {
            foreignKey: 'linkedTransactionId',
            as: 'reverseLinkedTransaction'
        });
    };

    return Transaction;
};
