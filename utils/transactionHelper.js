const { Account, Transaction, sequelize } = require('../models');
const { generateReference, formatAmount } = require('./accountHelper');
const AppError = require('./appError');

/**
 * Record a financial transaction with ACID compliance
 * @param {Object} options - Transaction options
 * @param {number} options.accountId - Account ID
 * @param {string} options.transactionType - Type of transaction
 * @param {number} options.amount - Transaction amount
 * @param {string} options.description - Transaction description
 * @param {number} options.performedBy - User ID who performed the transaction
 * @param {Object} options.t - Sequelize transaction object (optional, creates new if not provided)
 * @returns {Object} Transaction record
 */
exports.recordTransaction = async (options) => {
    const { accountId, transactionType, amount, description, performedBy, reference, t } = options;

    // Validate amount
    if (!amount || amount <= 0) {
        throw new AppError('Transaction amount must be greater than 0', 400);
    }

    // Use provided transaction or create new one
    const transaction = t || await sequelize.transaction();
    const shouldCommit = !t; // Only commit if we created the transaction

    try {
        // Get account with lock to prevent race conditions
        const account = await Account.findByPk(accountId, {
            lock: transaction.LOCK.UPDATE,
            transaction
        });

        if (!account) {
            throw new AppError('Account not found', 404);
        }

        if (account.status !== 'active') {
            throw new AppError(`Account is ${account.status}. Transactions not allowed.`, 400);
        }

        // Calculate new balance based on transaction type
        let newBalance = parseFloat(account.balance);

        if (['withdrawal', 'transfer_out'].includes(transactionType)) {
            // Debit operations
            if (newBalance < amount) {
                throw new AppError('Insufficient balance', 400);
            }
            newBalance -= parseFloat(amount);
        } else if (['deposit', 'loan_disbursement', 'loan_repayment', 'interest', 'dividend', 'transfer_in', 'share_purchase'].includes(transactionType)) {
            // Credit operations
            newBalance += parseFloat(amount);
        } else {
            throw new AppError('Invalid transaction type', 400);
        }

        // Create transaction record
        const txnRecord = await Transaction.create({
            accountId,
            institutionId: account.institutionId,
            transactionType,
            amount: formatAmount(amount),
            balanceAfter: formatAmount(newBalance),
            reference: reference || generateReference(),
            description,
            performedBy,
            status: 'completed',
            completedAt: new Date()
        }, { transaction });

        // Update account balance
        await account.update({
            balance: formatAmount(newBalance)
        }, { transaction });

        // Commit if we created the transaction
        if (shouldCommit) {
            await transaction.commit();
        }

        return txnRecord;
    } catch (error) {
        // Rollback if we created the transaction
        if (shouldCommit) {
            await transaction.rollback();
        }
        throw error;
    }
};

/**
 * Get paginated transaction history for an account
 * @param {number} accountId - Account ID
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 20)
 * @param {Date} options.startDate - Start date filter
 * @param {Date} options.endDate - End date filter
 * @returns {Object} Paginated transactions
 */
exports.getAccountStatement = async (accountId, options = {}) => {
    const pageInt = parseInt(options.page) || 1;
    const limitInt = parseInt(options.limit) || 20;
    const { startDate, endDate } = options;
    const offset = (pageInt - 1) * limitInt;

    const where = { accountId, status: 'completed' };

    // Add date filters if provided
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt[sequelize.Op.gte] = startDate;
        if (endDate) where.createdAt[sequelize.Op.lte] = endDate;
    }

    const { count, rows } = await Transaction.findAndCountAll({
        where,
        include: [{
            model: require('../models').User,
            as: 'performer',
            attributes: ['id', 'name', 'email']
        }],
        order: [['createdAt', 'DESC']],
        limit: limitInt,
        offset
    });

    return {
        transactions: rows,
        pagination: {
            total: count,
            page: pageInt,
            limit: limitInt,
            pages: Math.ceil(count / limitInt)
        }
    };
};
