const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Contribution = sequelize.define('Contribution', {
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
        month: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Format: YYYY-MM'
        },
        amount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('pending', 'paid', 'defaulted', 'failed_insufficient'),
            defaultValue: 'pending'
        },
        type: {
            type: DataTypes.ENUM('thrift', 'commission'),
            defaultValue: 'thrift',
            allowNull: false
        },
        collectionMethod: {
            type: DataTypes.ENUM('automatic', 'cash', 'manual_internal'),
            allowNull: true
        },
        paidAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        transactionId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'Transactions',
                key: 'id'
            }
        }
    }, {
        tableName: 'Contributions',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['userId', 'month', 'type']
            },
            {
                fields: ['institutionId']
            }
        ]
    });

    Contribution.associate = (models) => {
        Contribution.belongsTo(models.User, {
            foreignKey: 'userId',
            as: 'user'
        });
        Contribution.belongsTo(models.Transaction, {
            foreignKey: 'transactionId',
            as: 'transaction'
        });
        Contribution.belongsTo(models.Institution, {
            foreignKey: 'institutionId',
            as: 'institution'
        });
    };

    return Contribution;
};
