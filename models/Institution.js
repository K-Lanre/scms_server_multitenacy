const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Institution = sequelize.define('Institution', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'Unique slug or identifier for the institution (e.g., COOP001)'
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isEmail: true }
    },
    phone: {
      type: DataTypes.STRING
    },
    address: {
      type: DataTypes.TEXT
    },
    logoUrl: {
      type: DataTypes.STRING
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'suspended'),
      defaultValue: 'active'
    },
    settings: {
      type: DataTypes.JSON,
      defaultValue: {
        currency: 'NGN',
        timezone: 'Africa/Lagos',
        defaultInterestRate: 5,
        thriftFrequency: 'monthly'
      },
      get() {
        const rawValue = this.getDataValue('settings');
        if (typeof rawValue === 'string') {
          try {
            return JSON.parse(rawValue);
          } catch (e) {
            return rawValue;
          }
        }
        return rawValue;
      },
      set(value) {
        this.setDataValue('settings', value);
      }
    }
  }, {
    timestamps: true,
    tableName: 'Institutions'
  });

  Institution.associate = (models) => {
    Institution.hasMany(models.User, { foreignKey: 'institutionId' });
    Institution.hasMany(models.Account, { foreignKey: 'institutionId' });
    Institution.hasMany(models.Loan, { foreignKey: 'institutionId' });
  };

  return Institution;
};
