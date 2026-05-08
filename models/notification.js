const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Notification = sequelize.define('Notification', {
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
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        type: {
            type: DataTypes.ENUM('info', 'success', 'warning', 'error'),
            defaultValue: 'info'
        },
        link: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Internal app route to navigate to when clicked'
        },
        isRead: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        readAt: {
            type: DataTypes.DATE,
            allowNull: true
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
        tableName: 'Notifications',
        timestamps: true
    });

    Notification.associate = (models) => {
        Notification.belongsTo(models.User, {
            foreignKey: 'userId',
            as: 'user'
        });
    };

    return Notification;
};
