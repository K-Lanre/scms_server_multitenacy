'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Meeting extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Meeting.hasOne(models.MeetingMinute, {
        foreignKey: 'meetingId',
        as: 'minutes'
      });
      Meeting.belongsTo(models.Institution, {
        foreignKey: 'institutionId',
        as: 'institution'
      });
    }
  }
  Meeting.init({
    title: {
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
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM('general', 'executive', 'emergency', 'other'),
      allowNull: false
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    time: {
      type: DataTypes.STRING,
      allowNull: false
    },
    location: {
      type: DataTypes.STRING,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('scheduled', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'scheduled'
    }
  }, {
    sequelize,
    modelName: 'Meeting',
  });
  return Meeting;
};