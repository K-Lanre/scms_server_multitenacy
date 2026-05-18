const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Loan = sequelize.define('Loan', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id'
            }
        },
        institutionId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Institutions',
                key: 'id'
            }
        },
        loanType: {
            type: DataTypes.STRING,
            allowNull: true
        },
        loanPurpose: {
            type: DataTypes.STRING,
            allowNull: true
        },
        loanAmount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },
        interestRate: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false,
            comment: 'Annual interest rate in percentage'
        },
        duration: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: 'Loan duration in months'
        },
        monthlyPayment: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },
        totalRepayable: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },
        outstandingBalance: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('pending', 'approved', 'disbursed', 'repaying', 'completed', 'defaulted', 'rejected'),
            defaultValue: 'pending'
        },
        approvedBy: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'Users',
                key: 'id'
            }
        },
        disbursedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        nextPaymentDate: {
            type: DataTypes.DATE,
            allowNull: true
        },
        completedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Date when loan was fully repaid'
        },
        paystackTransferRecipient: {
            type: DataTypes.STRING,
            allowNull: true
        },
        disbursementReference: {
            type: DataTypes.STRING,
            allowNull: true
        },
        bankName: {
            type: DataTypes.STRING,
            allowNull: true
        },
        accountNumber: {
            type: DataTypes.STRING,
            allowNull: true
        },
        repaymentMode: {
            type: DataTypes.ENUM('manual', 'automated'),
            defaultValue: 'manual',
            allowNull: false
        },
        monthlyDeductionAmount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: true
        },
        dueDate: {
            type: DataTypes.DATE,
            allowNull: true
        },
        originalDueDate: {
            type: DataTypes.DATE,
            allowNull: true
        },
        lastDeductionDate: {
            type: DataTypes.DATE,
            allowNull: true
        },
        failedDeductionCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false
        },
        extensionCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false
        },
        remarks: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Note from the reviewer/approver'
        }
    }, {
        tableName: 'Loans',
        timestamps: true,
        indexes: [
            {
                fields: ['userId']
            },
            {
                fields: ['institutionId']
            },
            {
                fields: ['status']
            }
        ]
    });

    Loan.associate = (models) => {
        Loan.belongsTo(models.User, { foreignKey: 'userId', as: 'borrower' });
        Loan.belongsTo(models.User, { foreignKey: 'approvedBy', as: 'approver' });
        Loan.belongsTo(models.Institution, { foreignKey: 'institutionId', as: 'institution' });
        Loan.hasMany(models.LoanRepayment, { foreignKey: 'loanId', as: 'repayments' });
    };

    return Loan;
};
