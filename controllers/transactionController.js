const { Account, Transaction, User, sequelize } = require('../models');
const { recordTransaction } = require('../utils/transactionHelper');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { Op } = require('sequelize');
const Email = require('../utils/email');
const socketIO = require('../utils/socket');
const { attachInstitution } = require('../middleware/tenantMiddleware');

/**
 * @swagger
 * /api/v1/transactions/deposit:
 *   post:
 *     summary: Deposit money into an account
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accountId
 *               - amount
 *             properties:
 *               accountId:
 *                 type: integer
 *                 description: Account ID to deposit into
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 description: Amount to deposit
 *               description:
 *                 type: string
 *                 description: Transaction description
 *     responses:
 *       200:
 *         description: Deposit successful
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Account not found
 */
exports.deposit = catchAsync(async (req, res, next) => {
    const { accountId, amount, description } = req.body;

    // Validate input
    if (!accountId || !amount) {
        return next(new AppError('Account ID and amount are required', 400));
    }

    if (amount <= 0) {
        return next(new AppError('Amount must be greater than 0', 400));
    }

    // Record transaction (includes all validations and balance update)
    const transaction = await recordTransaction({
        accountId,
        transactionType: 'deposit',
        amount,
        description: description || 'Cash deposit',
        performedBy: req.user.id
    });

    // Get updated account
    const account = await Account.findByPk(accountId);

    // Socket real-time update
    socketIO.emitToUser(account.userId, 'account_sync', {
        type: 'deposit',
        accountId: account.id,
        amount
    });

    res.status(200).json({
        status: 'success',
        data: {
            transaction: {
                reference: transaction.reference,
                amount: transaction.amount,
                balanceAfter: transaction.balanceAfter,
                date: transaction.createdAt
            },
            account: {
                accountNumber: account.accountNumber,
                currentBalance: account.balance
            }
        }
    });
});

/**
 * @swagger
 * /api/v1/transactions/withdraw:
 *   post:
 *     summary: Withdraw money from an account
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accountId
 *               - amount
 *             properties:
 *               accountId:
 *                 type: integer
 *                 description: Account ID to withdraw from
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 description: Amount to withdraw
 *               description:
 *                 type: string
 *                 description: Transaction description
 *     responses:
 *       200:
 *         description: Withdrawal successful
 *       400:
 *         description: Bad request or insufficient balance
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Account not found
 */
exports.withdraw = catchAsync(async (req, res, next) => {
    const { accountId, amount, description } = req.body;

    // Validate input
    if (!accountId || !amount) {
        return next(new AppError('Account ID and amount are required', 400));
    }

    if (amount <= 0) {
        return next(new AppError('Amount must be greater than 0', 400));
    }

    // Record transaction (includes balance check and update)
    const transaction = await recordTransaction({
        accountId,
        transactionType: 'withdrawal',
        amount,
        description: description || 'Cash withdrawal',
        performedBy: req.user.id
    });

    // Send Email Alert
    try {
        const user = await User.findByPk(req.user.id);
        if (user && user.email) {
            const account = await Account.findByPk(accountId);
            const email = new Email(user, `${process.env.FRONTEND_URL}/transactions`);
            email.sendTransactionAlert(transaction, account, 'Debit');
        }
    } catch (emailErr) {
        console.error('Email alert failed:', emailErr);
    }

    // Get updated account
    const account = await Account.findByPk(accountId);

    // Socket real-time update
    socketIO.emitToUser(account.userId, 'account_sync', {
        type: 'withdrawal',
        accountId: account.id,
        amount
    });

    res.status(200).json({
        status: 'success',
        data: {
            transaction: {
                reference: transaction.reference,
                amount: transaction.amount,
                balanceAfter: transaction.balanceAfter,
                date: transaction.createdAt
            },
            account: {
                accountNumber: account.accountNumber,
                currentBalance: account.balance
            }
        }
    });
});

/**
 * @swagger
 * /api/v1/transactions:
 *   get:
 *     summary: Get all transactions (Filtered by user for members)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
exports.getAllTransactions = catchAsync(async (req, res, next) => {
    const { type, search } = req.query;
    const userId = req.user.id;
    const isStaff = ['staff', 'super_admin'].includes(req.user.role);

    const where = attachInstitution(req);

    // Filter by type if provided
    if (type) {
        where.transactionType = type;
    }

    // Search by reference or description
    if (search) {
        where[Op.or] = [
            { reference: { [Op.like]: `%${search}%` } },
            { description: { [Op.like]: `%${search}%` } }
        ];
    }

    // If not staff, only show transactions belonging to user's accounts
    const accountInclude = {
        model: Account,
        as: 'account',
        attributes: ['id', 'accountNumber', 'accountType']
    };

    if (!isStaff) {
        accountInclude.where = { userId };
    }

    const transactions = await Transaction.findAll({
        where,
        include: [accountInclude],
        order: [['createdAt', 'DESC']],
        limit: 100 // Default limit
    });

    res.status(200).json({
        status: 'success',
        results: transactions.length,
        data: transactions
    });
});

