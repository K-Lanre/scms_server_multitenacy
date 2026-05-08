const { Contribution, User, Account, Transaction, Notification, SystemSetting, sequelize } = require('../models');
const { getTreasuryAccount } = require('../utils/treasuryManager');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { Op } = require('sequelize');
const { generateReference } = require('../utils/accountHelper');
const { attachInstitution } = require('../middleware/tenantMiddleware');

/**
 * Get my contribution history
 */
exports.getMyContributions = catchAsync(async (req, res, next) => {
    const contributions = await Contribution.findAll({
        where: { userId: req.user.id, ...attachInstitution(req) },
        order: [['month', 'DESC']]
    });

    res.status(200).json({
        status: 'success',
        results: contributions.length,
        data: { contributions }
    });
});

/**
 * Admin: Get monthly contribution report
 */
exports.getMonthlyReport = catchAsync(async (req, res, next) => {
    const { month } = req.params; // YYYY-MM
    const { type } = req.query; // optional: thrift or commission

    const where = { month, ...attachInstitution(req) };
    if (type) where.type = type;

    const contributions = await Contribution.findAll({
        where,
        include: [{ 
            model: User, 
            as: 'user', 
            attributes: ['name', 'email', 'id'],
            include: [{
                model: Account,
                as: 'accounts',
                where: { accountType: 'savings' },
                required: false,
                attributes: ['accountNumber', 'balance']
            }]
        }]
    });

    res.status(200).json({
        status: 'success',
        results: contributions.length,
        data: { contributions }
    });
});

/**
 * Admin: Get Overall Statistics for the Thrift Pool
 */
exports.getContributionStats = catchAsync(async (req, res, next) => {
    // 1. Get the Admin Pool Balance (System Treasury)
    const poolAccount = await getTreasuryAccount();

    // 2. Get Collection Progress for current month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const stats = await Contribution.findAll({
        where: { month: currentMonth, ...attachInstitution(req) },
        attributes: [
            'status',
            'type',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
            [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount']
        ],
        group: ['status', 'type']
    });

    res.status(200).json({
        status: 'success',
        data: {
            poolBalance: parseFloat(poolAccount?.balance || 0),
            currentMonth,
            stats
        }
    });
});

/**
 * Admin: Trigger manual generation for a month (Thrift & Commission)
 */
exports.generateMonthlyRecords = catchAsync(async (req, res, next) => {
    const { month } = req.body; // YYYY-MM

    // 1. Check if records for this month already exist
    const existing = await Contribution.findOne({ where: { month, ...attachInstitution(req) } });
    if (existing) {
        return next(new AppError(`Records for ${month} have already been generated.`, 400));
    }
    
    const thriftSetting = await SystemSetting.findOne({ where: { key: 'monthly_thrift_amount' } });
    const commissionSetting = await SystemSetting.findOne({ where: { key: 'monthly_commission_amount' } });
    
    const thriftAmount = parseFloat(thriftSetting?.value || 5000);
    const commissionAmount = parseFloat(commissionSetting?.value || 500);

    const members = await User.findAll({ where: { role: 'member', status: 'active', ...attachInstitution(req) } });

    let createdCount = 0;
    for (const member of members) {
        // Thrift
        try {
            await Contribution.create({
                userId: member.id,
                institutionId: req.user.institutionId,
                month,
                amount: thriftAmount,
                type: 'thrift',
                status: 'pending'
            });
            createdCount++;
        } catch (err) {}

        // Commission
        try {
            await Contribution.create({
                userId: member.id,
                institutionId: req.user.institutionId,
                month,
                amount: commissionAmount,
                type: 'commission',
                status: 'pending'
            });
            createdCount++;
        } catch (err) {}
    }

    res.status(201).json({
        status: 'success',
        message: `Successfully generated ${createdCount} records for ${month}`
    });
});

/**
 * Admin: Record Cash Payment (Manual outside-system paying)
 */
exports.recordCashPayment = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    
    const contribution = await Contribution.findOne({ where: { id, ...attachInstitution(req) } });
    if (!contribution) return next(new AppError('Record not found', 404));
    if (contribution.status === 'paid') return next(new AppError('Already paid', 400));

    // Update record
    await contribution.update({
        status: 'paid',
        collectionMethod: 'cash',
        paidAt: new Date()
    });

    // TODO: Ideally, if cash is recorded, it should be logically added to the pool 
    // but without an electronic transfer from member savings.
    // For now, we just mark it as paid for auditing.

    res.status(200).json({
        status: 'success',
        data: { contribution }
    });
});

/**
 * Admin: Force Collect from Internal Balance
 */
exports.collectInternalBalance = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    
    const obligation = await Contribution.findOne({ where: { id, ...attachInstitution(req) } });
    if (!obligation) return next(new AppError('Record not found', 404));
    if (obligation.status === 'paid') return next(new AppError('Already paid', 400));

    const t = await sequelize.transaction();
    try {
        const memberAccount = await Account.findOne({
            where: { userId: obligation.userId, accountType: 'savings', status: 'active' },
            transaction: t
        });

        const adminAccount = await getTreasuryAccount(t);

        const amount = parseFloat(obligation.amount);

        if (!memberAccount || parseFloat(memberAccount.balance) < amount) {
            await t.rollback();
            // Mark as failed_insufficient if trying to collect and failed
            await obligation.update({ status: 'failed_insufficient' });
            return next(new AppError('Insufficient member balance for manual collection', 400));
        }

        // Perform Transfer: Member -> Admin
        const newMemberBalance = parseFloat(memberAccount.balance) - amount;
        const newAdminBalance = parseFloat(adminAccount.balance) + amount;

        await memberAccount.update({ balance: newMemberBalance }, { transaction: t });
        await adminAccount.update({ balance: newAdminBalance }, { transaction: t });

        const transaction = await Transaction.create({
            accountId: memberAccount.id,
            institutionId: req.user.institutionId,
            transactionType: 'withdrawal',
            amount,
            balanceAfter: newMemberBalance,  // ✅ Correct post-deduction balance
            reference: generateReference(),
            description: `Manual Collection: ${obligation.type} - ${obligation.month}`,
            performedBy: req.user.id,
            status: 'completed',
            completedAt: new Date()
        }, { transaction: t });

        // Double-entry: Record the corresponding deposit into the Admin Pool
        await Transaction.create({
            accountId: adminAccount.id,
            institutionId: req.user.institutionId,
            transactionType: 'deposit',
            amount,
            balanceAfter: newAdminBalance,
            reference: generateReference(),
            description: `Admin Pool Received: ${obligation.type} - ${obligation.month} (User #${obligation.userId})`,
            performedBy: req.user.id,
            status: 'completed',
            completedAt: new Date(),
            linkedTransactionId: transaction.id
        }, { transaction: t });

        await obligation.update({
            status: 'paid',
            collectionMethod: 'manual_internal',
            paidAt: new Date(),
            transactionId: transaction.id
        }, { transaction: t });

        // ✅ Notify member about the manual collection (mirrors automated job behaviour)
        await Notification.create({
            userId: obligation.userId,
            title: `${obligation.type === 'thrift' ? 'Thrift' : 'Commission'} Collected`,
            message: `₦${amount.toLocaleString()} has been collected for your ${obligation.month} ${obligation.type}.`,
            type: 'success',
            referenceType: 'contribution',
            link: '/savings'
        }, { transaction: t });

        await t.commit();

        res.status(200).json({
            status: 'success',
            data: { obligation }
        });
    } catch (err) {
        await t.rollback();
        throw err;
    }
});
