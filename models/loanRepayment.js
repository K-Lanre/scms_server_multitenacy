const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const LoanRepayment = sequelize.define('LoanRepayment', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        loanId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Loans',
                key: 'id'
            }
        },
        transactionId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'Transactions',
                key: 'id'
            }
        },
        amount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },
        principal: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },
        interest: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },
        paidAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        institutionId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'Institutions',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
        }
    }, {
        tableName: 'LoanRepayments',
        timestamps: true
    });

    LoanRepayment.associate = (models) => {
        LoanRepayment.belongsTo(models.Loan, { foreignKey: 'loanId', as: 'loan' });
        LoanRepayment.belongsTo(models.Transaction, { foreignKey: 'transactionId', as: 'transaction' });
    };

    return LoanRepayment;
};
