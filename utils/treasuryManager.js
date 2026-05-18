const { User, Account, sequelize } = require('../models');
const AppError = require('./appError');

const TREASURY_EMAIL = 'treasury@coop.system';

/**
 * Ensures the Cooperative Treasury user and primary savings account exist for a specific institution.
 * @param {number} institutionId - The ID of the institution
 * @param {Object} t - Sequelize transaction (optional)
 */
exports.getTreasuryAccount = async (institutionId, t = null) => {
    if (!institutionId) return null;

    // Build unique treasury identity for this institution
    const institutionTreasuryEmail = `treasury_${institutionId}@coop.system`;
    
    const options = { 
        where: { email: institutionTreasuryEmail },
        ...(t ? { transaction: t } : {})
    };

    // 1. Find or create the Treasury System User for this institution
    const [treasuryUser] = await User.findOrCreate({
        ...options,
        defaults: {
            name: `Institution ${institutionId} Treasury`,
            password: 'system-account-' + Math.random(),
            role: 'staff',
            status: 'active',
            institutionId: institutionId,
            isEmailVerified: true
        },
    });

    // 2. Find or create the Primary Treasury Account
    const [treasuryAccount] = await Account.findOrCreate({
        where: { userId: treasuryUser.id, accountType: 'savings' },
        defaults: {
            accountNumber: `VLT-${institutionId}-${Math.floor(1000 + Math.random() * 9000)}`,
            balance: 0,
            status: 'active',
            institutionId: institutionId
        },
        ...(t ? { transaction: t } : {})
    });

    return treasuryAccount;
};

exports.TREASURY_EMAIL = TREASURY_EMAIL;
