const { Account, User, Loan, UserSavingsPlan, SavingsProduct, Contribution } = require('../models');
const { generateAccountNumber } = require('../utils/accountHelper');
const { getAccountStatement } = require('../utils/transactionHelper');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { sendNotification } = require('../utils/notificationService');
const { attachInstitution } = require('../middleware/tenantMiddleware');


/**
 * @swagger
 * /api/v1/accounts:
 *   post:
 *     summary: Create a new account for a user
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - accountType
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: User ID to create account for
 *               accountType:
 *                 type: string
 *                 enum: [savings, share_capital]
 *                 description: Type of account
 *     responses:
 *       201:
 *         description: Account created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
exports.createAccount = catchAsync(async (req, res, next) => {
    const { userId, accountType } = req.body;

    // Validate user exists
    const user = await User.findByPk(userId);
    if (!user) {
        return next(new AppError('User not found', 404));
    }

    // Check if user already has this type of account
    const existingAccount = await Account.findOne({
        where: { userId, accountType }
    });

    if (existingAccount) {
        return next(new AppError(`User already has a ${accountType} account`, 400));
    }

    // Generate account number
    const accountNumber = await generateAccountNumber();

    // Create account
    const account = await Account.create({
        userId,
        institutionId: req.user.institutionId,
        accountNumber,
        accountType,
        balance: 0.00,
        status: 'active',
        openedAt: new Date()
    });

    res.status(201).json({
        status: 'success',
        data: {
            account: {
                id: account.id,
                accountNumber: account.accountNumber,
                accountType: account.accountType,
                balance: account.balance,
                status: account.status,
                openedAt: account.openedAt
            }
        }
    });
});

/**
 * @swagger
 * /api/v1/accounts:
 *   get:
 *     summary: Get all accounts (Admin/Staff only)
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Accounts retrieved successfully
 */
exports.getAllAccounts = catchAsync(async (req, res, next) => {
    let accounts;
    
    if (req.user.role === 'member') {
        // If member, only return their accounts
        accounts = await Account.findAll({
            where: { userId: req.user.id },
            attributes: ['id', 'accountNumber', 'accountType', 'balance', 'status', 'openedAt'],
            order: [['createdAt', 'ASC']]
        });
    } else {
        // If admin/staff, return all accounts
        accounts = await Account.findAll({
            where: attachInstitution(req),
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'name', 'email']
            }],
            order: [['createdAt', 'DESC']]
        });
    }

    res.status(200).json({
        status: 'success',
        results: accounts.length,
        data: {
            accounts
        }
    });
});

exports.getUserFinancials = catchAsync(async (req, res, next) => {
    const { userId } = req.params;

    const [accounts, loans, savingsPlans, contributions] = await Promise.all([
        Account.findAll({
            where: { userId },
            attributes: ['id', 'accountNumber', 'accountType', 'balance', 'status', 'openedAt'],
            order: [['createdAt', 'ASC']]
        }),
        Loan.findAll({
            where: { userId },
            order: [['createdAt', 'DESC']]
        }),
        UserSavingsPlan.findAll({
            where: { userId },
            include: [{
                model: SavingsProduct,
                as: 'product',
                attributes: ['name', 'type', 'interestRate']
            }],
            order: [['createdAt', 'DESC']]
        }),
        Contribution.findAll({
            where: { userId },
            order: [['month', 'DESC'], ['type', 'ASC']]
        })
    ]);

    res.status(200).json({
        status: 'success',
        data: {
            accounts,
            loans,
            savingsPlans,
            contributions
        }
    });
});

/**
 * @swagger
 * /api/v1/accounts/my-accounts:
 *   get:
 *     summary: Get all accounts for authenticated user
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Accounts retrieved successfully
 *       401:
 *         description: Unauthorized
 */
exports.getMyAccounts = catchAsync(async (req, res, next) => {
    const accounts = await Account.findAll({
        where: { userId: req.user.id, institutionId: req.user.institutionId },
        attributes: ['id', 'accountNumber', 'accountType', 'balance', 'status', 'openedAt'],
        order: [['createdAt', 'ASC']]
    });

    res.status(200).json({
        status: 'success',
        results: accounts.length,
        data: {
            accounts
        }
    });
});

/**
 * @swagger
 * /api/v1/accounts/{id}:
 *   get:
 *     summary: Get account by ID
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Account ID
 *     responses:
 *       200:
 *         description: Account retrieved successfully
 *       404:
 *         description: Account not found
 *       403:
 *         description: Forbidden
 */
exports.getAccountById = catchAsync(async (req, res, next) => {
    const account = await Account.findByPk(req.params.id, {
        include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email']
        }]
    });

    if (!account) {
        return next(new AppError('Account not found', 404));
    }

    // Check authorization: owner or staff can view
    if (account.userId !== req.user.id && !['staff', 'super_admin'].includes(req.user.role)) {
        return next(new AppError('You do not have permission to view this account', 403));
    }

    res.status(200).json({
        status: 'success',
        data: {
            account
        }
    });
});

/**
 * @swagger
 * /api/v1/accounts/{id}/statement:
 *   get:
 *     summary: Get account statement (transaction history)
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Account ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Statement retrieved successfully
 *       404:
 *         description: Account not found
 *       403:
 *         description: Forbidden
 */
exports.getAccountStatement = catchAsync(async (req, res, next) => {
    const account = await Account.findByPk(req.params.id);

    if (!account) {
        return next(new AppError('Account not found', 404));
    }

    // Check authorization: owner or staff can view
    if (account.userId !== req.user.id && !['staff', 'super_admin'].includes(req.user.role)) {
        return next(new AppError('You do not have permission to view this statement', 403));
    }

    const { page = 1, limit = 20 } = req.query;
    const statement = await getAccountStatement(account.id, { page, limit });

    res.status(200).json({
        status: 'success',
        data: {
            account: {
                accountNumber: account.accountNumber,
                currentBalance: account.balance
            },
            ...statement
        }
    });
});
/**
 * Admin: Record share purchase for a member
 * POST /api/v1/accounts/shares/purchase
 */
exports.purchaseShares = catchAsync(async (req, res, next) => {
    const { userId, amount, description } = req.body;
    const { Transaction, sequelize } = require('../models');
    const crypto = require('crypto');

    if (!userId || !amount || amount <= 0) {
        return next(new AppError('Please provide a valid userId and amount', 400));
    }

    // 1. Find the user and their share_capital account
    const account = await Account.findOne({
        where: { userId, accountType: 'share_capital' }
    });

    if (!account) {
        return next(new AppError('User does not have a share capital account', 404));
    }

    // 2. Perform atomic update: increment balance and record transaction
    const result = await sequelize.transaction(async (t) => {
        // Increment balance
        const updatedBalance = parseFloat(account.balance) + parseFloat(amount);
        await account.update({ balance: updatedBalance }, { transaction: t });

        // Record transaction
        const transaction = await Transaction.create({
            accountId: account.id,
            transactionType: 'share_purchase',
            amount,
            balanceAfter: updatedBalance,
            reference: `SHR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
            description: description || 'Share Capital Purchase',
            performedBy: req.user.id,
            status: 'completed',
            completedAt: new Date()
        }, { transaction: t });

        return { account, transaction };
    });

    // Notify Member
    await sendNotification({
        userId,
        title: 'Share Capital Updated',
        message: `Admin has recorded a share purchase of ₦${parseFloat(amount).toLocaleString()} for your account.`,
        type: 'success',
        link: '/dashboard'
    });

    res.status(200).json({
        status: 'success',
        message: 'Share capital purchase recorded successfully',
        data: result
    });
});
/**
 * Member: Buy shares from internal savings balance
 * POST /api/v1/accounts/shares/buy-from-savings
 */
exports.buyFromSavings = catchAsync(async (req, res, next) => {
    const { amount } = req.body;
    const { Transaction, sequelize } = require('../models');
    const crypto = require('crypto');
    const userId = req.user.id;

    if (!amount || amount <= 0) {
        return next(new AppError('Please provide a valid amount to purchase shares', 400));
    }

    // 1. Find both accounts
    const [savingsAccount, shareAccount] = await Promise.all([
        Account.findOne({ where: { userId, accountType: 'savings' } }),
        Account.findOne({ where: { userId, accountType: 'share_capital' } })
    ]);

    if (!savingsAccount || !shareAccount) {
        return next(new AppError('Member must have both savings and share capital accounts', 400));
    }

    // 2. Validate balance
    if (parseFloat(savingsAccount.balance) < parseFloat(amount)) {
        return next(new AppError('Insufficient savings balance to complete this purchase', 400));
    }

    // 3. Perform atomic transfer
    const result = await sequelize.transaction(async (t) => {
        // A. Deduct from Savings
        const newSavingsBalance = parseFloat(savingsAccount.balance) - parseFloat(amount);
        await savingsAccount.update({ balance: newSavingsBalance }, { transaction: t });

        // B. Credit to Share Capital
        const newShareBalance = parseFloat(shareAccount.balance) + parseFloat(amount);
        await shareAccount.update({ balance: newShareBalance }, { transaction: t });

        // C. Record Withdrawal Transaction (Savings)
        await Transaction.create({
            accountId: savingsAccount.id,
            transactionType: 'withdrawal',
            amount,
            balanceAfter: newSavingsBalance,
            reference: `WTH-SHR-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
            description: `Transfer to Share Capital`,
            performedBy: userId,
            status: 'completed',
            completedAt: new Date()
        }, { transaction: t });

        // D. Record Share Purchase Transaction (Share Capital)
        const shareTx = await Transaction.create({
            accountId: shareAccount.id,
            transactionType: 'share_purchase',
            amount,
            balanceAfter: newShareBalance,
            reference: `SHR-BY-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
            description: `Purchased from Savings Balance`,
            performedBy: userId,
            status: 'completed',
            completedAt: new Date()
        }, { transaction: t });

        return { savingsAccount, shareAccount, shareTx };
    });

    // Notify Member
    await sendNotification({
        userId: req.user.id,
        title: 'Shares Purchased',
        message: `You have successfully purchased ₦${parseFloat(amount).toLocaleString()} worth of shares from your savings.`,
        type: 'success',
        link: '/dashboard'
    });

    res.status(200).json({
        status: 'success',
        message: `Successfully purchased ₦${parseFloat(amount).toLocaleString()} worth of shares from your savings.`,
        data: result
    });
});
