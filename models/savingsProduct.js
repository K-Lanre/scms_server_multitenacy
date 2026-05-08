'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SavingsProduct extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      SavingsProduct.hasMany(models.UserSavingsPlan, {
        foreignKey: 'productId',
        as: 'plans'
      });
      SavingsProduct.belongsTo(models.Institution, {
        foreignKey: 'institutionId',
        as: 'institution'
      });
    }
  }
  SavingsProduct.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    institutionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Institutions',
        key: 'id'
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    type: {
      type: DataTypes.ENUM('fixed', 'target', 'safebox'),
      allowNull: false
    },
    category: {
      type: DataTypes.ENUM('none', 'rent', 'education', 'business', 'emergency', 'festive'),
      defaultValue: 'none',
      allowNull: false
    },
    isQuickSaving: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    interestRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    minDeposit: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    minDuration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30, // Minimum days
      comment: 'Minimum duration in days'
    },
    maxDuration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Maximum duration in days (optional)'
    },
    penaltyPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: 'Percentage of balance to deduct on early withdrawal'
    },
    allowEarlyWithdrawal: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: 'active'
    }
  }, {
    sequelize,
    modelName: 'SavingsProduct',
    indexes: [
      {
        unique: true,
        fields: ['name', 'institutionId']
      }
    ]
  });
  return SavingsProduct;
};