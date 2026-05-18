const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const JobConfig = sequelize.define('JobConfig', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        jobId: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        cronExpression: {
            type: DataTypes.STRING,
            allowNull: false
        },
        isEnabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        isSystem: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        lastRunAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        lastRunStatus: {
            type: DataTypes.ENUM('success', 'failed', 'running'),
            allowNull: true
        },
        category: {
            type: DataTypes.STRING,
            allowNull: true
        },
        performedBy: {
            type: DataTypes.INTEGER,
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
        tableName: 'JobConfigs',
        timestamps: true
    });

    JobConfig.associate = (models) => {
        // JobConfig belongs to User (the admin who last triggered/modified it)
        JobConfig.belongsTo(models.User, {
            foreignKey: 'performedBy',
            as: 'operator'
        });
    };

    return JobConfig;
};
