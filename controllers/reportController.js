const { Account, Loan, Transaction, LoanRepayment, sequelize, User, AuditLog, Institution } = require('../models');
const { Op } = require('sequelize');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { attachInstitution } = require('../middleware/tenantMiddleware');

/**
 * Generate Member Account Statement (JSON)
 * GET /api/v1/reports/statement?accountId=123&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
exports.getAccountStatement = catchAsync(async (req, res, next) => {
    const { accountId, startDate, endDate } = req.query;

    if (!accountId) {
        return next(new AppError('Please provide an accountId', 400));
    }

    const account = await Account.findOne({
        where: { id: accountId, ...attachInstitution(req) },
        include: [{ model: User, as: 'user' }]
    });

    if (!account) {
        return next(new AppError('Account not found', 404));
    }

    if (req.user.role === 'member' && account.userId !== req.user.id) {
        return next(new AppError('You do not have permission to view this statement', 403));
    }

    // Additional institution check
    if (account.institutionId !== req.user.institutionId && req.user.role !== 'super_admin') {
        return next(new AppError('You do not have permission to view this statement', 403));
    }

    const whereClause = { accountId: account.id, status: 'completed' };
    let openingBalance = 0;

    if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            whereClause.createdAt = { [Op.between]: [start, end] };
        } else {
            whereClause.createdAt = { [Op.gte]: start };
        }

        const lastTxnBeforeStart = await Transaction.findOne({
            where: {
                accountId: account.id,
                status: 'completed',
                createdAt: { [Op.lt]: start },
                ...attachInstitution(req)
            },
            order: [['createdAt', 'DESC']]
        });

        if (lastTxnBeforeStart) {
            openingBalance = lastTxnBeforeStart.balanceAfter;
        }
    } else if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.createdAt = { [Op.lte]: end };
    }

    const transactions = await Transaction.findAll({
        where: { ...whereClause, ...attachInstitution(req) },
        order: [['createdAt', 'ASC']]
    });

    res.status(200).json({
        status: 'success',
        data: {
            account: {
                accountNumber: account.accountNumber,
                accountType: account.accountType,
                ownerName: account.user.name
            },
            statementPeriod: {
                startDate: startDate || 'Beginning',
                endDate: endDate || 'Now',
                openingBalance
            },
            transactions
        }
    });
});

/**
 * Simple Transaction Export Logic
 */
exports.getTransactionExport = catchAsync(async (req, res, next) => {
    const { startDate, endDate, transactionType } = req.query;

    let whereClause = { status: 'completed', ...attachInstitution(req) };

    if (startDate || endDate) {
        const dateFilter = {};
        if (startDate) {
            const start = new Date(startDate);
            if (!isNaN(start.getTime())) {
                start.setHours(0, 0, 0, 0);
                dateFilter[Op.gte] = start;
            }
        }
        if (endDate) {
            const end = new Date(endDate);
            if (!isNaN(end.getTime())) {
                end.setHours(23, 59, 59, 999);
                dateFilter[Op.lte] = end;
            }
        }
        if (Object.keys(dateFilter).length > 0) {
            whereClause.createdAt = dateFilter;
        }
    }

    if (transactionType && transactionType !== 'all') {
        whereClause.transactionType = transactionType;
    }

    const transactions = await Transaction.findAll({
        where: whereClause,
        include: [{
            model: Account,
            as: 'account',
            where: attachInstitution(req),
            include: [{ model: User, as: 'user', attributes: ['name', 'id'] }]
        }],
        order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
        status: 'success',
        results: transactions.length,
        data: { transactions }
    });
});

/**
 * Institution Audit Log (scoped to the admin's own institution)
 * GET /api/v1/reports/audit-logs
 */
exports.getInstitutionAuditLogs = catchAsync(async (req, res, next) => {
    const { limit = 50, page = 1, action, userId } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const institutionId = req.user.institutionId;

    // Scope by institution via the user relation
    const userWhere = { institutionId };
    if (userId) userWhere.id = userId;

    const logWhere = {};
    if (action) logWhere.action = { [Op.like]: `%${action.toUpperCase()}%` };

    const { count, rows } = await AuditLog.findAndCountAll({
        where: logWhere,
        limit: parseInt(limit),
        offset,
        order: [['createdAt', 'DESC']],
        include: [{
            model: User,
            as: 'user',
            where: userWhere,
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
                pages: Math.ceil(count / parseInt(limit)),
                currentPage: parseInt(page)
            }
        }
    });
});
