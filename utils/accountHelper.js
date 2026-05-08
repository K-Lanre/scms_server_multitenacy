const crypto = require('crypto');

/**
 * Generate a unique account number
 * Format: ACC-YYYYMMDD-XXXXX (e.g., ACC-20260213-00001)
 */
exports.generateAccountNumber = async () => {
    const { Account } = require('../models');

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    // Find the last account created today
    const lastAccount = await Account.findOne({
        where: {
            accountNumber: {
                [require('sequelize').Op.like]: `ACC-${dateStr}-%`
            }
        },
        order: [['accountNumber', 'DESC']]
    });

    let sequence = 1;
    if (lastAccount) {
        const lastSequence = parseInt(lastAccount.accountNumber.split('-')[2]);
        sequence = lastSequence + 1;
    }

    const paddedSequence = sequence.toString().padStart(5, '0');
    return `ACC-${dateStr}-${paddedSequence}`;
};

/**
 * Generate a unique transaction reference
 * Format: TXN-TIMESTAMP-RANDOM (e.g., TXN-1707854400000-A3F9)
 */
exports.generateReference = () => {
    const timestamp = Date.now();
    const random = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `TXN-${timestamp}-${random}`;
};

/**
 * Format amount to 2 decimal places
 */
exports.formatAmount = (amount) => {
    return Math.ceil(parseFloat(amount || 0));
};
