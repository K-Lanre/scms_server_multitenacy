const { User, Account, Loan, UserSavingsPlan, Transaction, WithdrawalRequest, sequelize } = require('../models');
const { Op } = require('sequelize');
const catchAsync = require('../utils/catchAsync');
const { getTreasuryAccount } = require('../utils/treasuryManager');
const { attachInstitution } = require('../middleware/tenantMiddleware');

/**
 * Get statistics for the dashboard based on user role
 */
exports.getDashboardStats = catchAsync(async (req, res, next) => {
    const { role, id: userId } = req.user;
    const { type } = req.query; // 'personal' or 'system'

    const isStaff = ['institution_admin', 'super_admin', 'staff'].includes(role);

    // LOGIC: 
    // - Regular members ALWAYS get personal stats.
    // - Admins get System stats by default, UNLESS they specifically ask for 'personal'.
    const shouldShowSystemStats = isStaff && type !== 'personal';

    if (shouldShowSystemStats) {
        // --- SYSTEM/ADMIN STATS (Organizational Overview) ---

        // 1. Total Members
        const totalMembers = await User.count({ 
            where: { 
                role: 'member', 
                ...attachInstitution(req) 
            } 
        });

        // 2. Total Cooperative Assets (Total Balance of all accounts in scope)
        const totalSystemFunds = await Account.sum('balance', { 
            where: attachInstitution(req) 
        }) || 0;

        // 3. Breakdown
        const totalSavingsVolume = await Account.sum('balance', { 
            where: { 
                accountType: 'savings', 
                ...attachInstitution(req) 
            } 
        }) || 0;
        const totalShareVolume = await Account.sum('balance', { 
            where: { 
                accountType: 'share_capital', 
                ...attachInstitution(req) 
            } 
        }) || 0;

        // 4. Total Disbursed Loans (Principal)
        const loansVolume = await Loan.sum('loanAmount', {
            where: { status: { [Op.in]: ['disbursed', 'repaying', 'defaulted'] }, ...attachInstitution(req) }
        }) || 0;

        // 5. Total Outstanding Loan Balance
        const totalOutstandingLoans = await Loan.sum('outstandingBalance', {
            where: { status: { [Op.in]: ['disbursed', 'repaying', 'defaulted'] }, ...attachInstitution(req) }
        }) || 0;

        // 6. Pending Requests
        const pendingLoans = await Loan.count({ where: { status: 'pending', ...attachInstitution(req) } });
        const pendingRegistrations = await User.count({ where: { status: 'pending_approval', ...attachInstitution(req) } });
        const pendingWithdrawals = await WithdrawalRequest.count({ where: { status: 'pending', ...attachInstitution(req) } });

        // 7. Defaulters
        const defaultersCount = await Loan.count({ where: { status: 'defaulted', ...attachInstitution(req) } });

        // 8. Treasury Balance (available for loans)
        // Note: Treasury is per-institution. If global view (no institutionId), we default to 0
        let treasuryBalance = 0;
        if (req.institutionId) {
            const treasuryAccount = await getTreasuryAccount(req.institutionId);
            treasuryBalance = parseFloat(treasuryAccount?.balance || 0);
        }

        res.status(200).json({
            status: 'success',
            data: {
                totalMembers: totalMembers.toLocaleString(),
                totalSystemFunds: `₦${parseFloat(totalSystemFunds).toLocaleString()}`,
                totalSystemFundsNumeric: parseFloat(totalSystemFunds),
                totalSavingsVolume: `₦${parseFloat(totalSavingsVolume).toLocaleString()}`,
                totalSavingsVolumeNumeric: parseFloat(totalSavingsVolume),
                totalShareVolume: `₦${parseFloat(totalShareVolume).toLocaleString()}`,
                totalShareVolumeNumeric: parseFloat(totalShareVolume),
                totalLoansVolume: `₦${(loansVolume / 1000000).toFixed(1)}M`, // Display as 0.X Million
                totalOutstandingLoans: `₦${parseFloat(totalOutstandingLoans).toLocaleString()}`,
                pendingActions: pendingLoans + pendingRegistrations + pendingWithdrawals,
                pendingLoans,
                pendingRegistrations,
                pendingWithdrawals,
                defaulters: defaultersCount,
                treasuryBalance: `₦${treasuryBalance.toLocaleString()}`,
                treasuryBalanceNumeric: treasuryBalance,
                roleStatus: 'admin_system'
            }
        });
    } else {
        // --- PERSONAL MEMBER STATS (Individual Data) ---

        const savingsAccount = await Account.findOne({
            where: { userId, accountType: 'savings', institutionId: req.user.institutionId }
        });

        const loanStats = await Loan.findOne({
            where: { userId, status: { [Op.in]: ['disbursed', 'repaying', 'defaulted'] }, institutionId: req.user.institutionId },
            attributes: [[sequelize.fn('SUM', sequelize.col('outstandingBalance')), 'total']]
        });

        const shareAccount = await Account.findOne({
            where: { userId, accountType: 'share_capital', institutionId: req.user.institutionId }
        });

        const recentTransactions = await Transaction.findAll({
            where: { institutionId: req.user.institutionId },
            include: [{
                model: Account,
                as: 'account',
                where: { userId },
                attributes: []
            }],
            limit: 5,
            order: [['createdAt', 'DESC']]
        });

        const savingsBalance = parseFloat(savingsAccount?.balance || 0);
        const outstandingLoan = parseFloat(loanStats?.dataValues.total || 0);
        const netBalance = Math.max(0, savingsBalance - outstandingLoan);

        res.status(200).json({
            status: 'success',
            data: {
                mySavings: `₦${savingsBalance.toLocaleString()}`,
                mySavingsNumeric: savingsBalance,
                loanBalance: `₦${outstandingLoan.toLocaleString()}`,
                loanBalanceNumeric: outstandingLoan,
                netBalance: `₦${netBalance.toLocaleString()}`,
                netBalanceNumeric: netBalance,
                shares: `${parseFloat(shareAccount?.balance || 0).toLocaleString()} units`,
                sharesNumeric: parseFloat(shareAccount?.balance || 0),
                recentTransactions,
                roleStatus: 'personal'
            }
        });
    }
});

/**
 * Get time-series data for dashboard charts (Last 6 Months)
 */
exports.getChartData = catchAsync(async (req, res, next) => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        months.push(d.toLocaleString('default', { month: 'short' }));
    }

    // Aggregate real data: Savings (Transactions) and Loans (Original Amounts)
    const chartData = await Promise.all(months.map(async (month, index) => {
        const monthStart = new Date();
        monthStart.setMonth(monthStart.getMonth() - (5 - index));
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);

        // Sum Savings Transactions (Credit only)
        const savingsVolume = await Transaction.sum('amount', {
            where: {
                transactionType: { [Op.in]: ['deposit', 'savings_contribution'] },
                createdAt: { [Op.between]: [monthStart, monthEnd] },
                ...attachInstitution(req)
            }
        }) || 0;

        // Sum Loan Principal Disbursed
        const loansVolume = await Loan.sum('loanAmount', {
            where: {
                status: { [Op.in]: ['disbursed', 'repaying', 'completed'] },
                createdAt: { [Op.between]: [monthStart, monthEnd] },
                ...attachInstitution(req)
            }
        }) || 0;

        return {
            name: month,
            savings: parseFloat(savingsVolume),
            loans: parseFloat(loansVolume)
        };
    }));

    res.status(200).json({
        status: 'success',
        data: chartData
    });
});
