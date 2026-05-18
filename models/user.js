'use strict';
const { Model } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     */
    static associate(models) {
      // User has many accounts
      User.hasMany(models.Account, {
        foreignKey: 'userId',
        as: 'accounts'
      });
      // User performs many transactions
      User.hasMany(models.Transaction, {
        foreignKey: 'performedBy',
        as: 'performedTransactions'
      });
      // User has many loans
      User.hasMany(models.Loan, {
        foreignKey: 'userId',
        as: 'loans'
      });
      // User is a guarantor for many loans
      // User has many withdrawal requests
      User.hasMany(models.WithdrawalRequest, {
        foreignKey: 'userId',
        as: 'withdrawalRequests'
      });
      // User processes many withdrawal requests
      User.hasMany(models.WithdrawalRequest, {
        foreignKey: 'processedBy',
        as: 'processedWithdrawals'
      });
      // User belongs to an Institution
      User.belongsTo(models.Institution, {
        foreignKey: 'institutionId',
        as: 'institution'
      });
    }

    async validatePassword(password) {
      return await bcrypt.compare(password, this.password);
    }
  }

  User.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    institutionId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Allow null for super_admins or global users if needed
      references: {
        model: 'Institutions',
        key: 'id'
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('super_admin', 'institution_admin', 'staff', 'member', 'user'),
      defaultValue: 'user'
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'suspended', 'pending_onboarding', 'pending_approval', 'rejected'),
      defaultValue: 'pending_onboarding'
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    gender: {
      type: DataTypes.STRING,
      allowNull: true
    },
    occupation: {
      type: DataTypes.STRING,
      allowNull: true
    },
    employer: {
      type: DataTypes.STRING,
      allowNull: true
    },
    maritalStatus: {
      type: DataTypes.STRING,
      allowNull: true
    },
    membershipType: {
      type: DataTypes.STRING,
      allowNull: true
    },
    addressProof: {
      type: DataTypes.STRING,
      allowNull: true
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },
    address: {
      type: DataTypes.STRING,
      allowNull: true
    },
    state: {
      type: DataTypes.STRING,
      allowNull: true
    },
    lga: {
      type: DataTypes.STRING,
      allowNull: true
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    nextOfKinName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    nextOfKinPhone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    nextOfKinRelationship: {
      type: DataTypes.STRING,
      allowNull: true
    },
    nextOfKinAddress: {
      type: DataTypes.STRING,
      allowNull: true
    },
    idType: {
      type: DataTypes.STRING,
      allowNull: true
    },
    idNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },
    idImage: {
      type: DataTypes.STRING,
      allowNull: true
    },
    profilePicture: {
      type: DataTypes.STRING,
      allowNull: true
    },
    paystackCustomerCode: {
      type: DataTypes.STRING,
      allowNull: true
    },
    passwordChangedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    passwordResetToken: {
      type: DataTypes.STRING,
      allowNull: true
    },
    passwordResetExpires: {
      type: DataTypes.DATE,
      allowNull: true
    },
    emailVerificationToken: {
      type: DataTypes.STRING,
      allowNull: true
    },
    emailVerificationExpires: {
      type: DataTypes.DATE,
      allowNull: true
    },
    bankName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    bankCode: {
      type: DataTypes.STRING,
      allowNull: true
    },
    accountNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },
    paystackRecipientCode: {
      type: DataTypes.STRING,
      allowNull: true
    },

  }, {
    sequelize,
    modelName: 'User',
    timestamps: true,
    hooks: {
      beforeSave: async (user) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, 12);

          // Only update passwordChangedAt if the password was not newly created
          if (!user.isNewRecord) {
            user.passwordChangedAt = Date.now() - 1000; // Subtract 1s to ensure JWT issued after change is valid
          }
        }


      }
    }
  });

  User.prototype.createPasswordResetToken = function () {
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');

    this.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    return resetToken;
  };

  User.prototype.createEmailVerificationToken = function () {
    // Generate a simple 6-digit code for email verification
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // We can just store the string code directly without hashing for simpler validation 
    // or hash it if we want extra security. Given it's a 6 digit code sent to email, 
    // hashing it is safer against DB leaks.
    const crypto = require('crypto');
    this.emailVerificationToken = crypto
      .createHash('sha256')
      .update(verificationCode)
      .digest('hex');

    this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    return verificationCode;
  };

  return User;
};