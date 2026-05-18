const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const WithdrawalRequest = sequelize.define('WithdrawalRequest', {
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
        amount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            validate: {
                min: 0.01
            }
        },
        status: {
            type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cancelled'),
            allowNull: false,
            defaultValue: 'pending'
        },
        reason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        rejectionReason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        processedBy: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'Users',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
        },
        processedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        paystackTransferReference: {
            type: DataTypes.STRING,
            allowNull: true
        },
        recipientName: {
            type: DataTypes.STRING,
            allowNull: true
        },
        recipientAccount: {
            type: DataTypes.STRING,
            allowNull: true
        },
        recipientBank: {
            type: DataTypes.STRING,
            allowNull: true
        },
        isExternalTransfer: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
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
        tableName: 'WithdrawalRequests',
        timestamps: true,
        indexes: [
            {
                fields: ['userId']
            },
            {
                fields: ['accountId']
            },
            {
                fields: ['status']
            },
            {
                fields: ['createdAt']
            }
        ]
    });

    WithdrawalRequest.associate = (models) => {
        WithdrawalRequest.belongsTo(models.User, {
            foreignKey: 'userId',
            as: 'user'
        });
        WithdrawalRequest.belongsTo(models.Account, {
            foreignKey: 'accountId',
            as: 'account'
        });
        WithdrawalRequest.belongsTo(models.User, {
            foreignKey: 'processedBy',
            as: 'processor'
        });
        WithdrawalRequest.belongsTo(models.Institution, {
            foreignKey: 'institutionId',
            as: 'institution'
        });
    };

    return WithdrawalRequest;
};
