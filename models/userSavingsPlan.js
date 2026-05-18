'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class UserSavingsPlan extends Model {
    /**
     * Helper method for defining associations.
     */
    static associate(models) {
      // define association here
      UserSavingsPlan.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user'
      });
      UserSavingsPlan.belongsTo(models.SavingsProduct, {
        foreignKey: 'productId',
        as: 'product'
      });
      UserSavingsPlan.belongsTo(models.Account, {
        foreignKey: 'accountId',
        as: 'account'
      });
    }
  }
  UserSavingsPlan.init({
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'SavingsProducts',
        key: 'id'
      }
    },
    accountId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Accounts',
        key: 'id'
      }
    },
    planName: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Personalized name given to the plan by the user'
    },
    targetAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: 'Target amount for goal-based plans'
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Duration in days chosen by user'
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    maturityDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    autoSaveAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: 'Amount to auto-debit if recurring'
    },
    frequency: {
      type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'manual'),
      allowNull: false,
      defaultValue: 'manual'
    },
    status: {
      type: DataTypes.ENUM('active', 'completed', 'defaulted', 'liquidated'),
      defaultValue: 'active'
    },
    lastInterestDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Last date interest was credited'
    },
    lastAutoSaveDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Last date automated deposit was processed'
    },
    withdrawalRequestedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp when withdrawal was requested (for SafeBox 24h delay)'
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
    sequelize,
    modelName: 'UserSavingsPlan',
  });
  return UserSavingsPlan;
};