const { Institution, User, Account, Loan, Transaction, AuditLog, WithdrawalRequest, sequelize } = require('../models');
const { Op } = require('sequelize');
const catchAsync = require('../utils/catchAsync');
const Email = require('../utils/email');

/**
 * @swagger
 * /api/v1/super-admin/stats:
 *   get:
 *     summary: Get system-wide statistics (Super Admin only)
 *     tags: [Super Admin]
 */
exports.getSystemStats = catchAsync(async (req, res, next) => {
    // Total institutions
    const totalInstitutions = await Institution.count();
    const activeInstitutions = await Institution.count({ where: { status: 'active' } });

    // Total users across all institutions
    const totalUsers = await User.count();
    const totalMembers = await User.count({ where: { role: 'member' } });
    const totalAdmins = await User.count({ where: { role: 'institution_admin' } });
    const totalStaff = await User.count({ where: { role: 'staff' } });

    // Financial totals across all institutions
    const totalSystemFunds = await Account.sum('balance') || 0;
    const totalSavings = await Account.sum('balance', {
        where: { accountType: { [Op.in]: ['savings', 'savings_plan'] } }
    }) || 0;

    // Loan metrics
    const totalLoansDisbursed = await Loan.sum('loanAmount', {
        where: { status: { [Op.in]: ['disbursed', 'repaying', 'completed', 'defaulted'] } }
    }) || 0;
    const totalOutstandingLoans = await Loan.sum('outstandingBalance', {
        where: { status: { [Op.in]: ['disbursed', 'repaying', 'defaulted'] } }
    }) || 0;
    const activeLoans = await Loan.count({
        where: { status: { [Op.in]: ['disbursed', 'repaying'] } }
    });
    const defaultedLoans = await Loan.count({ where: { status: 'defaulted' } });
    const pendingLoans = await Loan.count({ where: { status: 'pending' } });
    const pendingRegistrations = await User.count({ where: { status: 'pending_approval' } });
    const pendingWithdrawals = await WithdrawalRequest.count({ where: { status: 'pending' } });

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const recentUsers = await User.count({
        where: { createdAt: { [Op.gte]: thirtyDaysAgo } }
    });
    
    const recentTransactions = await Transaction.count({
        where: { 
            createdAt: { [Op.gte]: thirtyDaysAgo },
            status: 'completed'
        }
    });

    const recentTransactionVolume = await Transaction.sum('amount', {
        where: {
            createdAt: { [Op.gte]: thirtyDaysAgo },
            status: 'completed'
        }
    }) || 0;

    res.status(200).json({
        status: 'success',
        data: {
            institutions: {
                total: totalInstitutions,
                active: activeInstitutions
            },
            users: {
                total: totalUsers,
                members: totalMembers,
                admins: totalAdmins,
                staff: totalStaff
            },
            finances: {
                totalSystemFunds,
                totalSavings,
                totalLoansDisbursed,
                totalOutstandingLoans
            },
            loans: {
                active: activeLoans,
                defaulted: defaultedLoans,
                pending: pendingLoans
            },
            pendingActions: {
                loans: pendingLoans,
                registrations: pendingRegistrations,
                withdrawals: pendingWithdrawals,
                total: pendingLoans + pendingRegistrations + pendingWithdrawals
            },
            recentActivity: {
                newUsers: recentUsers,
                transactions: recentTransactions,
                transactionVolume: recentTransactionVolume
            }
        }
    });
});

/**
 * @swagger
 * /api/v1/super-admin/recent-activity:
 *   get:
 *     summary: Get recent activity across all institutions
 *     tags: [Super Admin]
 */
exports.getRecentActivity = catchAsync(async (req, res, next) => {
    const limit = parseInt(req.query.limit) || 10;

    // Recent users
    const recentUsers = await User.findAll({
        order: [['createdAt', 'DESC']],
        limit,
        attributes: ['id', 'name', 'email', 'role', 'institutionId', 'createdAt'],
        include: [{
            model: Institution,
            as: 'institution',
            attributes: ['name', 'code']
        }]
    });

    // Recent transactions
    const recentTransactions = await Transaction.findAll({
        order: [['createdAt', 'DESC']],
        limit,
        where: { status: 'completed' },
        include: [{
            model: Account,
            as: 'account',
            include: [{
                model: User,
                as: 'user',
                attributes: ['name', 'email']
            }]
        }]
    });

    // Recent loans
    const recentLoans = await Loan.findAll({
        order: [['createdAt', 'DESC']],
        limit,
        where: { status: { [Op.in]: ['pending', 'disbursed'] } },
        include: [{
            model: User,
            as: 'borrower',
            attributes: ['name', 'email']
        }]
    });

    // Recent Audit Logs
    const recentLogs = await AuditLog.findAll({
        order: [['createdAt', 'DESC']],
        limit: 5,
        include: [{
            model: User,
            as: 'user',
            attributes: ['name'],
            include: [{ model: Institution, as: 'institution', attributes: ['name'] }]
        }]
    });

    res.status(200).json({
        status: 'success',
        data: {
            users: recentUsers,
            transactions: recentTransactions,
            loans: recentLoans,
            logs: recentLogs
        }
    });
});

/**
 * @swagger
 * /api/v1/super-admin/institutions-summary:
 *   get:
 *     summary: Get summary stats for each institution
 *     tags: [Super Admin]
 */
exports.getInstitutionsSummary = catchAsync(async (req, res, next) => {
    const institutions = await Institution.findAll({
        attributes: ['id', 'name', 'code', 'email', 'status', 'createdAt'],
        order: [['createdAt', 'DESC']]
    });

    // Get stats for each institution
    const institutionsWithStats = await Promise.all(
        institutions.map(async (inst) => {
            const userCount = await User.count({ where: { institutionId: inst.id } });
            const memberCount = await User.count({ 
                where: { institutionId: inst.id, role: 'member' } 
            });
            const totalBalance = await Account.sum('balance', {
                where: { institutionId: inst.id }
            }) || 0;
            const loanCount = await Loan.count({ where: { institutionId: inst.id } });

            return {
                ...inst.toJSON(),
                memberCount: memberCount,
                totalUsers: userCount,
                totalBalance,
                loanCount
            };
        })
    );

    res.status(200).json({
        status: 'success',
        results: institutionsWithStats.length,
        data: { institutions: institutionsWithStats }
    });
});

/**
 * @swagger
 * /api/v1/super-admin/users/search:
 *   get:
 *     summary: Search for any user across all institutions
 *     tags: [Super Admin]
 */
exports.searchAllUsers = catchAsync(async (req, res, next) => {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
        return res.status(200).json({ status: 'success', data: { users: [] } });
    }

    const users = await User.findAll({
        where: {
            [Op.or]: [
                { name: { [Op.like]: `%${query}%` } },
                { email: { [Op.like]: `%${query}%` } },
                { phoneNumber: { [Op.like]: `%${query}%` } }
            ]
        },
        limit: 50,
        include: [{
            model: Institution,
            as: 'institution',
            attributes: ['name', 'code']
        }],
        attributes: ['id', 'name', 'email', 'phoneNumber', 'role', 'status', 'createdAt']
    });

    res.status(200).json({
        status: 'success',
        results: users.length,
        data: { users }
    });
});

/**
 * @swagger
 * /api/v1/super-admin/audit-logs:
 *   get:
 *     summary: Get platform-wide audit logs
 *     tags: [Super Admin]
 */
exports.getAuditLogs = catchAsync(async (req, res, next) => {
    const { limit = 50, page = 1, action, userId } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (action) where.action = action;
    if (userId) where.userId = userId;

    const { count, rows } = await AuditLog.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']],
        include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'role'],
            include: [{
                model: Institution,
                as: 'institution',
                attributes: ['name', 'code']
            }]
        }]
    });

    res.status(200).json({
        status: 'success',
        data: {
            logs: rows,
            pagination: {
                total: count,
                pages: Math.ceil(count / limit),
                currentPage: parseInt(page)
            }
        }
    });
});

/**
 * @swagger
 * /api/v1/super-admin/institutions/:id:
 *   get:
 *     summary: Get deep-dive details for a specific institution
 *     tags: [Super Admin]
 */
exports.getInstitutionDetail = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const institution = await Institution.findByPk(id);
    if (!institution) {
        return next(new AppError('Institution not found', 404));
    }

    // 1. Key Metrics
    const totalMembers = await User.count({ where: { institutionId: id, role: 'member' } });
    const totalAdmins = await User.count({ where: { institutionId: id, role: 'institution_admin' } });
    
    const totalSavingsBalance = await Account.sum('balance', {
        where: { institutionId: id, accountType: { [Op.in]: ['savings', 'savings_plan'] } }
    }) || 0;

    const totalLoansOutstanding = await Loan.sum('outstandingBalance', {
        where: { institutionId: id, status: { [Op.in]: ['disbursed', 'repaying', 'defaulted'] } }
    }) || 0;

    // 2. Transaction Volume (Current Month)
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthlyVolume = await Transaction.sum('amount', {
        where: {
            institutionId: id,
            status: 'completed',
            createdAt: { [Op.gte]: startOfMonth }
        }
    }) || 0;

    // 3. Recent Activity
    const recentActivity = await Transaction.findAll({
        where: { institutionId: id, status: 'completed' },
        limit: 10,
        order: [['createdAt', 'DESC']],
        include: [{ model: Account, as: 'account', include: [{ model: User, as: 'user', attributes: ['name'] }] }]
    });

    const recentMembers = await User.findAll({
        where: { institutionId: id, role: 'member' },
        limit: 5,
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'name', 'email', 'status', 'createdAt']
    });

    // 4. Pending Actions
    const pendingLoans = await Loan.count({ where: { institutionId: id, status: 'pending' } });
    const pendingWithdrawals = await WithdrawalRequest.count({ where: { institutionId: id, status: 'pending' } });

    // 5. Admins
    const admins = await User.findAll({
        where: { institutionId: id, role: 'institution_admin' },
        attributes: ['id', 'name', 'email', 'phoneNumber', 'status']
    });

    res.status(200).json({
        status: 'success',
        data: {
            institution,
            metrics: {
                totalMembers,
                totalAdmins,
                totalSavingsBalance,
                totalLoansOutstanding,
                monthlyVolume,
                pendingActions: {
                    loans: pendingLoans,
                    withdrawals: pendingWithdrawals
                }
            },
            recentActivity,
            recentMembers,
            admins
        }
    });
});

/**
 * @desc Get all users with super_admin role
 */
exports.getPlatformAdmins = catchAsync(async (req, res, next) => {
    const admins = await User.findAll({
        where: { role: 'super_admin' },
        attributes: ['id', 'name', 'email', 'phoneNumber', 'status', 'createdAt']
    });

    res.status(200).json({
        status: 'success',
        results: admins.length,
        data: { admins }
    });
});

/**
 * @desc Create a new platform administrator (super_admin)
 */
exports.createPlatformUser = catchAsync(async (req, res, next) => {
    const { name, email, password, phoneNumber } = req.body;

    // 1. Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
        return res.status(400).json({
            status: 'fail',
            message: 'User with this email already exists'
        });
    }

    // 2. Create the user
    const newUser = await User.create({
        name,
        email,
        password,
        phoneNumber,
        role: 'super_admin',
        status: 'active',
        isEmailVerified: true // Set to true as it's created by another super admin
    });

    // 3. Send welcome email with credentials
    try {
        await new Email(newUser, '').sendPlatformAdminWelcome(password);
    } catch (err) {
        // Log error but don't fail the request as user is already created
        console.error('Error sending platform admin welcome email:', err);
    }

    // Remove password from output
    newUser.password = undefined;

    res.status(201).json({
        status: 'success',
        data: { user: newUser }
    });
});
