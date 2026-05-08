const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const AuditLog = sequelize.define('AuditLog', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'Users',
                key: 'id'
            }
        },
        action: {
            type: DataTypes.STRING,
            allowNull: false
        },
        details: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        ipAddress: {
            type: DataTypes.STRING,
            allowNull: true
        },
        userAgent: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        tableName: 'AuditLogs',
        timestamps: true,
        updatedAt: false, // Audit logs are immutable
        indexes: [
            {
                fields: ['userId']
            },
            {
                fields: ['action']
            },
            {
                fields: ['createdAt']
            }
        ]
    });

    AuditLog.associate = (models) => {
        AuditLog.belongsTo(models.User, {
            foreignKey: 'userId',
            as: 'user'
        });
    };

    return AuditLog;
};
