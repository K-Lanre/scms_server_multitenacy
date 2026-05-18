const { Account, User, Transaction, sequelize } = require('../models');
const { formatAmount } = require('../utils/accountHelper');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { logAction } = require('../utils/auditLogger');
const { Op } = require('sequelize');

/**
 * Get statistics for a potential posting run (eligible members, total volume)
 */
exports.getPostingStats = catchAsync(async (req, res, next) => {
    const { type, rate = 0, productId, minBalanceSource = 0, taxRate = 0 } = req.query;

    const targetAccountType = type === 'interest' ? 'savings' : 'share_capital';
    const minBalance = parseFloat(minBalanceSource) || 0;

    const where = {
        accountType: targetAccountType,
        status: 'active',
        balance: { [Op.gte]: minBalance }
    };

    if (type === 'interest' && productId && productId !== 'all') {
        const { UserSavingsPlan } = require('../models');
        const eligibleAccounts = await Account.findAll({
            where,
            include: [{
                model: UserSavingsPlan,
                as: 'savingsPlan',
                where: { savingsProductId: productId },
                required: true
            }]
        });

        const totalVolume = eligibleAccounts.reduce((sum, acc) => sum + parseFloat(acc.balance), 0);
        const grossDistribution = totalVolume * (parseFloat(rate) / 100);
        const totalTax = grossDistribution * (parseFloat(taxRate) / 100);

        return res.status(200).json({
            status: 'success',
            data: {
                eligibleMembers: eligibleAccounts.length,
                totalVolume: formatAmount(totalVolume),
                estimatedDistribution: formatAmount(grossDistribution),
                estimatedTax: formatAmount(totalTax),
                netDistribution: formatAmount(grossDistribution - totalTax),
                targetAccountType
            }
        });
    }

    const stats = await Account.findAll({
        attributes: [
            [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
            [sequelize.fn('SUM', sequelize.col('balance')), 'totalVolume']
        ],
        where,
        raw: true
    });

    const count = parseInt(stats[0].count || 0);
    const totalVolume = parseFloat(stats[0].totalVolume || 0);
    const grossDistribution = totalVolume * (parseFloat(rate) / 100);
    const totalTax = grossDistribution * (parseFloat(taxRate) / 100);

    res.status(200).json({
        status: 'success',
        data: {
            eligibleMembers: count,
            totalVolume: formatAmount(totalVolume),
            estimatedDistribution: formatAmount(grossDistribution),
            estimatedTax: formatAmount(totalTax),
            netDistribution: formatAmount(grossDistribution - totalTax),
            targetAccountType
        }
    });
});

/**
 * Process immediate interest or dividend posting
 */
exports.processPosting = catchAsync(async (req, res, next) => {
    const { type, period, rate, targetProductId, minBalance = 0, taxRate = 0, isDryRun = true } = req.body;

    if (!period || !rate || rate <= 0) {
        return next(new AppError('Period and a positive rate are required', 400));
    }

    const targetAccountType = type === 'interest' ? 'savings' : 'share_capital';
    const where = {
        accountType: targetAccountType,
        status: 'active',
        balance: { [Op.gte]: minBalance }
    };

    let eligibleAccounts = [];
    if (type === 'interest' && targetProductId && targetProductId !== 'all') {
        const { UserSavingsPlan } = require('../models');
        eligibleAccounts = await Account.findAll({
            where,
            include: [{
                model: UserSavingsPlan,
                as: 'savingsPlan',
                where: { savingsProductId: targetProductId },
                required: true
            }]
        });
    } else {
        eligibleAccounts = await Account.findAll({ where });
    }

    if (eligibleAccounts.length === 0) {
        return next(new AppError('No eligible accounts found.', 404));
    }

    const actualTotalGross = eligibleAccounts.reduce((sum, acc) =>
        sum + (parseFloat(acc.balance) * (parseFloat(rate) / 100)), 0);
    const totalTax = actualTotalGross * (parseFloat(taxRate) / 100);

    if (isDryRun) {
        // Add a preview of the first 10 accounts for the UI
        const preview = eligibleAccounts.slice(0, 10).map(acc => {
            const currentBalance = parseFloat(acc.balance);
            const grossPayout = currentBalance * (parseFloat(rate) / 100);
            const taxDeduction = grossPayout * (parseFloat(taxRate) / 100);
            const netPayout = grossPayout - taxDeduction;

            return {
                accountId: acc.id,
                currentBalance: formatAmount(currentBalance),
                grossPayout: formatAmount(grossPayout),
                taxDeduction: formatAmount(taxDeduction),
                netPayout: formatAmount(netPayout)
            };
        });

        return res.status(200).json({
            status: 'success',
            data: {
                isDryRun: true,
                summary: {
                    type, period, rate: `${rate}%`,
                    beneficiaryCount: eligibleAccounts.length,
                    totalGrossAmount: formatAmount(actualTotalGross),
                    totalTaxAmount: formatAmount(totalTax),
                    netAmount: formatAmount(actualTotalGross - totalTax)
                },
                preview
            }
        });
    }

    const t = await sequelize.transaction();

    try {
        let totalActuallyPosted = 0;
        let totalTaxCollected = 0;

        for (const account of eligibleAccounts) {
            const currentBalance = parseFloat(account.balance);
            const grossPayout = currentBalance * (parseFloat(rate) / 100);
            const taxDeduction = grossPayout * (parseFloat(taxRate) / 100);
            const netPayout = grossPayout - taxDeduction;

            if (grossPayout <= 0) continue;

            const newBalance = currentBalance + netPayout;
            await account.update({ balance: formatAmount(newBalance) }, { transaction: t });

            await Transaction.create({
                accountId: account.id,
                transactionType: type,
                amount: formatAmount(grossPayout),
                balanceAfter: formatAmount(currentBalance + grossPayout),
                reference: `${type.toUpperCase()}-${period}-${account.id}-G`,
                description: `${type.charAt(0).toUpperCase() + type.slice(1)} credit for ${period} @ ${rate}%`,
                performedBy: req.user.id,
                status: 'completed',
                completedAt: new Date()
            }, { transaction: t });

            if (taxDeduction > 0) {
                await Transaction.create({
                    accountId: account.id,
                    transactionType: 'tax_deduction',
                    amount: formatAmount(taxDeduction),
                    balanceAfter: formatAmount(newBalance),
                    reference: `${type.toUpperCase()}-WHT-${period}-${account.id}`,
                    description: `Withholding Tax (${taxRate}%) on ${type} payout`,
                    performedBy: req.user.id,
                    status: 'completed',
                    completedAt: new Date()
                }, { transaction: t });
            }

            totalActuallyPosted += grossPayout;
            totalTaxCollected += taxDeduction;
        }

        await t.commit();

        logAction(req, `${type.toUpperCase()}_POSTED`, {
            period, rate, totalAmount: totalActuallyPosted, beneficiaryCount: eligibleAccounts.length
        });

        res.status(200).json({
            status: 'success',
            message: `${type} posted successfully to ${eligibleAccounts.length} accounts.`
        });

    } catch (error) {
        await t.rollback();
        next(new AppError(`Posting failed: ${error.message}`, 500));
    }
});

exports.getPostingHistory = catchAsync(async (req, res, next) => {
    // Since PostingLog is removed, we return an empty array or simple transaction query
    res.status(200).json({
        status: 'success',
        results: 0,
        data: { logs: [] }
    });
});
