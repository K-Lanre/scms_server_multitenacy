const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const SystemSetting = sequelize.define('SystemSetting', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        key: {
            type: DataTypes.STRING,
            allowNull: false
        },
        value: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.STRING,
            allowNull: true
        },
        type: {
            type: DataTypes.ENUM('string', 'number', 'boolean', 'json'),
            defaultValue: 'string'
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
        tableName: 'SystemSettings',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['key', 'institutionId'],
                name: 'system_settings_key_institution_unique'
            }
        ]
    });

    return SystemSetting;
};
