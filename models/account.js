const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Account = sequelize.define('Account', {
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
        accountNumber: {
            type: DataTypes.STRING(20),
            allowNull: false,
            unique: true
        },
        accountType: {
            type: DataTypes.ENUM('savings', 'share_capital', 'savings_plan'),
            allowNull: false,
            defaultValue: 'savings'
        },
        balance: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00,
            validate: {
                min: 0
            }
        },
        status: {
            type: DataTypes.ENUM('active', 'frozen', 'closed'),
            allowNull: false,
            defaultValue: 'active'
        },
        openedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        closedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        paystackChannel: {
            type: DataTypes.STRING,
            allowNull: true
        },
        paystackDedicatedAccountNumber: {
            type: DataTypes.STRING,
            allowNull: true
        },
        paystackDedicatedAccountBank: {
            type: DataTypes.STRING,
            allowNull: true
        },
        paystackDedicatedAccountName: {
            type: DataTypes.STRING,
            allowNull: true
        },
        paystackAssignmentReference: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        tableName: 'Accounts',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['accountNumber']
            }
        ]
    });

    Account.associate = (models) => {
        Account.belongsTo(models.User, {
            foreignKey: 'userId',
            as: 'user'
        });
        Account.belongsTo(models.Institution, {
            foreignKey: 'institutionId',
            as: 'institution'
        });
        Account.hasMany(models.Transaction, {
            foreignKey: 'accountId',
            as: 'transactions'
        });
        Account.hasMany(models.WithdrawalRequest, {
            foreignKey: 'accountId',
            as: 'withdrawalRequests'
        });
    };

    // Instance method to check if withdrawal is allowed
    Account.prototype.canWithdraw = function (amount) {
        return this.status === 'active' && this.balance >= amount;
    };

    return Account;
};
