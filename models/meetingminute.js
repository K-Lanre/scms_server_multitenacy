'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class MeetingMinute extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      MeetingMinute.belongsTo(models.Meeting, {
        foreignKey: 'meetingId',
        as: 'meeting'
      });
      MeetingMinute.belongsTo(models.User, {
        foreignKey: 'recordedBy',
        as: 'recorder'
      });
    }
  }
  MeetingMinute.init({
    meetingId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    fileUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    attendanceCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    recordedBy: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'MeetingMinute',
  });
  return MeetingMinute;
};