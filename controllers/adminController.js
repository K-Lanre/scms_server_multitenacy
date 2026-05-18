const { User, Account, Loan, UserSavingsPlan, SavingsProduct, Transaction, LoanRepayment, sequelize } = require('../models');
const catchAsync = require('../utils/catchAsync');
const { logAction } = require('../utils/auditLogger');
const { getTreasuryAccount } = require('../utils/treasuryManager');
const { attachInstitution } = require('../middleware/tenantMiddleware');

/**
 * @swagger
 * /api/v1/admin/financial-summary:
 *   get:
 *     summary: Get overall financial health summary
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Financial summary retrieved
 */
exports.getFinancialSummary = catchAsync(async (req, res, next) => {
    const { Op } = require('sequelize');

    // Total members
    const totalMembers = await User.count({ where: { role: 'member', ...attachInstitution(req) } });

    // Total savings balance
    const savingsAccounts = await Account.findAll({
        where: { accountType: { [Op.in]: ['savings', 'savings_plan'] }, ...attachInstitution(req) },
        attributes: [[sequelize.fn('SUM', sequelize.col('balance')), 'total']]
    });
    const totalSavings = parseFloat(savingsAccounts[0]?.dataValues.total || 0);

    // Loan metrics
    const totalDisbursed = await Loan.sum('loanAmount', {
        where: { status: { [Op.in]: ['disbursed', 'repaying', 'completed', 'defaulted'] }, ...attachInstitution(req) }
    }) || 0;

    const totalOutstanding = await Loan.sum('outstandingBalance', {
        where: { status: { [Op.in]: ['disbursed', 'repaying', 'defaulted'] }, ...attachInstitution(req) }
    }) || 0;

    const totalRepaid = totalDisbursed - totalOutstanding;

    // Savings plan metrics
    const activePlans = await UserSavingsPlan.count({ where: { status: 'active', ...attachInstitution(req) } });
    const completedPlans = await UserSavingsPlan.count({ where: { status: 'completed', ...attachInstitution(req) } });

    // Calculate repayment rate
    const repaymentRate = totalDisbursed > 0 ? ((totalRepaid / totalDisbursed) * 100).toFixed(2) : 0;

    res.status(200).json({
        status: 'success',
        data: {
            summary: {
                totalMembers,
                totalSavingsBalance: parseFloat(totalSavings.toFixed(2)),
                totalLoansDisbursed: parseFloat(totalDisbursed.toFixed(2)),
                totalOutstandingLoans: parseFloat(totalOutstanding.toFixed(2)),
                totalRepaid: parseFloat(totalRepaid.toFixed(2)),
                repaymentRate: `${repaymentRate}%`,
                activeSavingsPlans: activePlans,
                completedSavingsPlans: completedPlans
            }
        }
    });
});

/**
 * @swagger
 * /api/v1/admin/loan-metrics:
 *   get:
 *     summary: Get detailed loan metrics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Loan metrics retrieved
 */
exports.getLoanMetrics = catchAsync(async (req, res, next) => {
    const { Op } = require('sequelize');

    // Loans by status
    const loansByStatus = await Loan.findAll({
        where: attachInstitution(req),
        attributes: [
            'status',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
            [sequelize.fn('SUM', sequelize.col('loanAmount')), 'totalAmount'],
            [sequelize.fn('SUM', sequelize.col('outstandingBalance')), 'totalOutstanding']
        ],
        group: ['status']
    });

    // Average loan amount
    const avgLoanAmount = await Loan.findAll({
        attributes: [[sequelize.fn('AVG', sequelize.col('loanAmount')), 'average']],
        where: { status: { [Op.ne]: 'rejected' }, ...attachInstitution(req) }
    });

    // Default rate
    const totalLoans = await Loan.count({
        where: { status: { [Op.in]: ['disbursed', 'repaying', 'completed', 'defaulted'] }, ...attachInstitution(req) }
    });
    const defaultedLoans = await Loan.count({ where: { status: 'defaulted', ...attachInstitution(req) } });
    const defaultRate = totalLoans > 0 ? ((defaultedLoans / totalLoans) * 100).toFixed(2) : 0;

    // Top defaulters (users with defaulted loans)
    const topDefaulters = await Loan.findAll({
        where: { status: 'defaulted', ...attachInstitution(req) },
        include: [{
            model: User,
            as: 'borrower',
            attributes: ['id', 'name', 'email']
        }],
        attributes: ['id', 'loanAmount', 'outstandingBalance', 'extensionCount'],
        order: [['outstandingBalance', 'DESC']],
        limit: 10
    });

    res.status(200).json({
        status: 'success',
        data: {
            loansByStatus,
            averageLoanAmount: parseFloat(avgLoanAmount[0]?.dataValues.average || 0).toFixed(2),
            defaultRate: `${defaultRate}%`,
            topDefaulters
        }
    });
});

/**
 * @swagger
 * /api/v1/admin/savings-metrics:
 *   get:
 *     summary: Get detailed savings metrics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Savings metrics retrieved
 */
exports.getSavingsMetrics = catchAsync(async (req, res, next) => {
    // Savings by product type
    const savingsByProduct = await UserSavingsPlan.findAll({
        where: attachInstitution(req),
        include: [{
            model: SavingsProduct,
            as: 'product',
            attributes: ['name', 'type', 'interestRate']
        }, {
            model: Account,
            as: 'account',
            attributes: ['balance']
        }],
        attributes: [
            [sequelize.fn('COUNT', sequelize.col('UserSavingsPlan.id')), 'count']
        ],
        group: ['product.id', 'product.name', 'product.type', 'product.interestRate']
    });

    // Plans by status
    const plansByStatus = await UserSavingsPlan.findAll({
        where: attachInstitution(req),
        attributes: [
            'status',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status']
    });

    // Average plan balance
    const avgBalance = await UserSavingsPlan.findAll({
        include: [{
            model: Account,
            as: 'account',
            attributes: []
        }],
        attributes: [[sequelize.fn('AVG', sequelize.col('account.balance')), 'average']],
        where: { status: 'active', ...attachInstitution(req) }
    });

    // Top savers (active plans with highest balance)
    const topSavers = await UserSavingsPlan.findAll({
        where: { status: 'active', ...attachInstitution(req) },
        include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email']
        }, {
            model: Account,
            as: 'account',
            attributes: ['balance']
        }, {
            model: SavingsProduct,
            as: 'product',
            attributes: ['name']
        }],
        order: [[{ model: Account, as: 'account' }, 'balance', 'DESC']],
        limit: 10
    });

    res.status(200).json({
        status: 'success',
        data: {
            savingsByProduct,
            plansByStatus,
            averagePlanBalance: parseFloat(avgBalance[0]?.dataValues.average || 0).toFixed(2),
            topSavers
        }
    });
});

/**
 * @swagger
 * /api/v1/admin/treasury-balance:
 *   get:
 *     summary: Get Cooperative Treasury balance (available for loans)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Treasury balance retrieved
 */
exports.getTreasuryBalance = catchAsync(async (req, res, next) => {
    const treasuryAccount = await getTreasuryAccount(req.institutionId);

    // Also get total system funds for comparison
    const { Op } = require('sequelize');
    const totalSystemFunds = await Account.sum('balance', { where: attachInstitution(req) }) || 0;

    res.status(200).json({
        status: 'success',
        data: {
            treasuryBalance: parseFloat(treasuryAccount?.balance || 0),
            totalSystemFunds: parseFloat(totalSystemFunds),
            availableForLoans: parseFloat(treasuryAccount?.balance || 0)
        }
    });
});
