const { Op } = require('sequelize');
const { Loan, Account, Transaction, sequelize, User, SystemSetting } = require('../models');
const Email = require('../utils/email');
const { recordTransaction } = require('../utils/transactionHelper');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { formatAmount } = require('../utils/accountHelper');
const { logAction } = require('../utils/auditLogger');
const { sendNotification } = require('../utils/notificationService');
const socketIO = require('../utils/socket');
const { getTreasuryAccount } = require('../utils/treasuryManager');
const { attachInstitution } = require('../middleware/tenantMiddleware');


/**
 * @swagger
 * /api/v1/loans/apply:
 *   post:
 *     summary: Apply for a new loan
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - loanAmount
 *               - duration
 *             properties:
 *               loanAmount:
 *                 type: number
 *                 description: Amount to borrow
 *               duration:
 *                 type: integer
 *                 description: Duration in months
 *               interestRate:
 *                 type: number
 *                 description: Monthly interest rate (defaults to 2%)
 *     responses:
 *       201:
 *         description: Loan application submitted
 */
const PaystackService = require('../services/paystackService');
const loanCalculator = require('../utils/loanCalculator');

/**
 * @swagger
 * /api/v1/loans/apply:
 *   post:
 *     summary: Apply for a new loan
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - loanAmount
 *               - duration
 *             properties:
 *               loanAmount:
 *                 type: number
 *               duration:
 *                 type: integer
 *               interestRate:
 *                 type: number
 *               bankName:
 *                 type: string
 *               accountNumber:
 *                 type: string
 *               repaymentMode:
 *                 type: string
 *                 enum: [manual, automated]
 *               monthlyDeductionAmount:
 *                 type: number
 *     responses:
 *       201:
 *         description: Loan application submitted
 */
exports.applyForLoan = catchAsync(async (req, res, next) => {
    const {
        loanAmount,
        duration,
        interestRate = 2,
        bankName,
        accountNumber,
        repaymentMode = 'manual',
        monthlyDeductionAmount,
        loanType,
        loanPurpose
    } = req.body;

    if (!loanAmount || !duration) {
        return next(new AppError('Loan amount and duration are required', 400));
    }

    // --- Dynamic Interest Rate Logic ---
    let finalInterestRate = parseFloat(interestRate);
    
    try {
        const settings = await SystemSetting.findOne({ 
            where: { key: 'loan_interest_tiers', institutionId: req.user.institutionId } 
        });

        if (settings && settings.value) {
            const tiers = JSON.parse(settings.value);
            const matchingTier = tiers.find(t => duration >= t.minMonths && duration <= t.maxMonths);
            
            if (matchingTier) {
                console.log(`[Loan Application] Applying tier rate: ${matchingTier.rate}% for ${duration} months`);
                finalInterestRate = matchingTier.rate;
            }
        }
    } catch (err) {
        console.error('[Loan Application] Error fetching interest tiers:', err.message);
        // Fallback to default or provided rate
    }

    // If still not set or invalid, use a hard default
    if (isNaN(finalInterestRate)) finalInterestRate = 2;
    // -----------------------------------

    // Validate repayment mode
    if (!['manual', 'automated'].includes(repaymentMode)) {
        return next(new AppError('Repayment mode must be either "manual" or "automated"', 400));
    }

    // If automated, validate monthly deduction amount
    if (repaymentMode === 'automated') {
        if (!monthlyDeductionAmount || monthlyDeductionAmount <= 0) {
            return next(new AppError('Monthly deduction amount is required for automated repayment', 400));
        }

        // Calculate minimum payment to ensure loan can be paid within reasonable time
        const minPayment = loanCalculator.calculateMinimumPayment(loanAmount, interestRate, duration);

        if (monthlyDeductionAmount < minPayment) {
            return next(new AppError(
                `Monthly deduction amount (₦${monthlyDeductionAmount}) is too low. Minimum required: ₦${minPayment}`,
                400
            ));
        }
    }

    // Calculate loan details
    let totalInterest, totalRepayable, monthlyPayment, calculatedDuration;

    if (repaymentMode === 'automated') {
        // Use loan calculator for automated mode
        const schedule = loanCalculator.calculateMonthlySchedule(
            loanAmount,
            finalInterestRate,
            monthlyDeductionAmount
        );

        totalInterest = schedule.totalInterest;
        totalRepayable = schedule.totalRepayable;
        monthlyPayment = monthlyDeductionAmount;
        calculatedDuration = schedule.months;
    } else {
        // Simple interest calculation for manual mode (Interest = P * R * T, where T is in years)
        totalInterest = parseFloat(loanAmount) * (parseFloat(finalInterestRate) / 100) * (parseInt(duration) / 12);
        totalRepayable = parseFloat(loanAmount) + totalInterest;
        monthlyPayment = totalRepayable / parseInt(duration);
        calculatedDuration = duration;
    }



    // Update user bank details if provided
    if (bankName && accountNumber) {
        if (!req.user.bankName || !req.user.accountNumber) {
            await req.user.update({ bankName, accountNumber });
        }
    }

    const loan = await Loan.create({
        userId: req.user.id,
        institutionId: req.user.institutionId,
        loanAmount: formatAmount(loanAmount),
        interestRate: formatAmount(finalInterestRate),
        duration: calculatedDuration,
        monthlyPayment: formatAmount(monthlyPayment),
        totalRepayable: formatAmount(totalRepayable),
        outstandingBalance: formatAmount(totalRepayable),
        status: 'pending',
        bankName: bankName || req.user.bankName,
        accountNumber: accountNumber || req.user.accountNumber,
        repaymentMode,
        monthlyDeductionAmount: repaymentMode === 'automated' ? formatAmount(monthlyDeductionAmount) : null,
        loanType,
        loanPurpose
    });



    // Success Notification for Applicant
    await sendNotification({
        userId: req.user.id,
        title: 'Loan Application Submitted',
        message: `Your loan application for ₦${parseFloat(loan.loanAmount).toLocaleString()} has been received and is pending review.`,
        type: 'success',
        link: '/loans/my-loans'
    });

    // Notify local admins of the new application
    const admins = await User.findAll({
        where: { 
            institutionId: req.user.institutionId,
            role: { [Op.in]: ['institution_admin', 'staff'] }, 
            status: 'active' 
        }
    });

    for (const admin of admins) {
        await sendNotification({
            userId: admin.id,
            title: 'New Loan Application 📝',
            message: `${req.user.name} has requested a loan of ₦${parseFloat(loan.loanAmount).toLocaleString()}.`,
            type: 'info',
            link: `/admin/loans?status=pending`
        });
    }

    // Real-time dashboard update (broadcast)
    socketIO.emitToAdmins('request_sync', {
        type: 'new_loan_application',
        applicant: req.user.name,
        amount: loan.loanAmount
    });

    res.status(201).json({
        status: 'success',
        data: {
            loan,
            calculatedDuration: repaymentMode === 'automated' ? calculatedDuration : undefined,
            totalInterest: formatAmount(totalInterest)
        }
    });
});

/**
 * @swagger
 * /api/v1/loans/my-loans:
 *   get:
 *     summary: Get logged in member's loans
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 */
/**
 * @swagger
 * /api/v1/loans/{id}:
 *   get:
 *     summary: Get specific loan details for review
 *     tags: [Loans]
 */
exports.getLoanDetails = catchAsync(async (req, res, next) => {
    const loan = await Loan.findByPk(req.params.id, {
        include: [
            { model: User, as: 'borrower', include: [{ model: Account, as: 'accounts', where: { accountType: 'savings' } }] },
            { model: User, as: 'approver', attributes: ['name', 'email'] }
        ]
    });

    if (!loan) {
        return next(new AppError('Loan application not found', 404));
    }

    res.status(200).json({
        status: 'success',
        data: { loan }
    });
});

exports.getMyLoans = catchAsync(async (req, res, next) => {
    const loans = await Loan.findAll({
        where: { userId: req.user.id, institutionId: req.user.institutionId },
        include: [
            { model: User, as: 'borrower', attributes: ['name', 'email'] },
            { model: User, as: 'approver', attributes: ['name', 'email'] }
        ],
        order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
        status: 'success',
        results: loans.length,
        data: loans
    });
});

/**
 * @swagger
 * /api/v1/loans/stats/portfolio:
 *   get:
 *     summary: Get loan portfolio statistics for admin dashboard
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 */
exports.getPortfolioStats = catchAsync(async (req, res, next) => {
    const { Op, fn, col } = require('sequelize');

    // 1. Overall Summary (Outstanding, Active Count, Interest Revenue)
    // Interest Revenue = sum(totalRepayable - loanAmount)
    const stats = await Loan.findAll({
        attributes: [
            [fn('SUM', col('outstandingBalance')), 'totalOutstanding'],
            [fn('COUNT', col('id')), 'totalCount'],
            [fn('SUM', sequelize.literal('totalRepayable - loanAmount')), 'interestRevenue']
        ],
        where: {
            ...attachInstitution(req),
            status: { [Op.in]: ['disbursed', 'repaying', 'defaulted', 'completed'] }
        },
        raw: true
    });

    // 2. Portfolio at Risk (Defaulted)
    const atRisk = await Loan.findAll({
        attributes: [
            [fn('SUM', col('outstandingBalance')), 'atRiskValue'],
            [fn('COUNT', col('id')), 'atRiskCount']
        ],
        where: { ...attachInstitution(req), status: 'defaulted' },
        raw: true
    });

    // 3. Distribution by Purpose
    const distribution = await Loan.findAll({
        attributes: [
            [sequelize.literal('COALESCE(loanPurpose, "Other")'), 'loanPurpose'],
            [fn('SUM', col('outstandingBalance')), 'value']
        ],
        where: {
            ...attachInstitution(req),
            status: { [Op.in]: ['disbursed', 'repaying', 'defaulted'] }
        },
        group: ['loanPurpose'],
        raw: true
    });

    res.status(200).json({
        status: 'success',
        data: {
            summary: {
                totalOutstanding: parseFloat(stats[0].totalOutstanding || 0),
                totalCount: parseInt(stats[0].totalCount || 0),
                interestRevenue: parseFloat(stats[0].interestRevenue || 0)
            },
            atRisk: {
                value: parseFloat(atRisk[0].atRiskValue || 0),
                count: parseInt(atRisk[0].atRiskCount || 0)
            },
            distribution: distribution.map(d => ({
                name: d.loanPurpose,
                value: parseFloat(d.value || 0)
            }))
        }
    });
});

/**
 * @swagger
 * /api/v1/loans:
 *   get:
 *     summary: Get all loans (Staff sees all, Members see their own)
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 */
exports.getAllLoans = catchAsync(async (req, res, next) => {
    const { Op } = require('sequelize');
    let filter = attachInstitution(req);
    if (req.user.role === 'member') {
        filter.userId = req.user.id;
    } else if (req.query.userId) {
        filter.userId = req.query.userId;
    }

    // Support ?status=pending,under_review,rejected (comma-separated or single)
    if (req.query.status) {
        const statuses = req.query.status.split(',').map(s => s.trim()).filter(Boolean);
        filter.status = statuses.length === 1 ? statuses[0] : { [Op.in]: statuses };
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    // Get total count for pagination metadata
    const totalCount = await Loan.count({ where: filter });

    const loans = await Loan.findAll({
        where: filter,
        include: [
            { model: User, as: 'borrower', attributes: ['name', 'email'] },
            { model: User, as: 'approver', attributes: ['name', 'email'] }
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset
    });

    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
        status: 'success',
        results: loans.length,
        pagination: {
            page,
            limit,
            totalCount,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        },
        data: { loans }
    });
});

/**
 * @swagger
 * /api/v1/loans/{id}/review:
 *   patch:
 *     summary: Approve or reject a loan application
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 */
exports.reviewLoan = catchAsync(async (req, res, next) => {
    const { status, remarks } = req.body; // status: approved, rejected

    if (!['approved', 'rejected'].includes(status)) {
        return next(new AppError('Status must be approved or rejected', 400));
    }

    const loan = await Loan.findByPk(req.params.id);
    if (!loan) {
        return next(new AppError('Loan not found', 404));
    }

    // Allow transition from pending to approved/rejected
    const allowedTransitions = {
        'pending': ['approved', 'rejected']
    };

    if (!allowedTransitions[loan.status] || !allowedTransitions[loan.status].includes(status)) {
        return next(new AppError(`Cannot transition loan from ${loan.status} to ${status}`, 400));
    }



    await loan.update({
        status,
        remarks: remarks || loan.remarks,
        approvedBy: req.user.id
    });

    logAction(req, `LOAN_${status.toUpperCase()}`, { loanId: loan.id, userId: loan.userId });

    // Notify Applicant
    if (status) {
        await sendNotification({
            userId: loan.userId,
            title: `Loan ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            message: status === 'approved'
                ? `Congratulations! Your loan application for ₦${parseFloat(loan.loanAmount).toLocaleString()} has been approved.`
                : `Sorry, your loan application for ₦${parseFloat(loan.loanAmount).toLocaleString()} was rejected. Remarks: ${remarks || 'None'}`,
            type: status === 'approved' ? 'success' : 'error',
            link: '/loans/my-loans'
        });

        // Also send an email to the borrower
        try {
            const borrower = await User.findByPk(loan.userId, { attributes: ['name', 'email'] });
            if (borrower) {
                const clientUrl = process.env.CLIENT_URL || 'http://localhost:5174';
                await new Email(borrower, `${clientUrl}/loans/my-loans`).sendLoanDecision(loan, status, remarks);
            }
            // Socket real-time update
            socketIO.emitToUser(loan.userId, 'account_sync', {
                type: 'loan_status_update',
                loanId: loan.id,
                status
            });
        } catch (emailErr) {
            // Don't block the response if email fails — log it and continue
            console.error('Loan decision email failed:', emailErr.message);
        }
    }

    res.status(200).json({
        status: 'success',
        data: { loan }
    });
});

/**
 * Higher level wrappers for convenience
 */
exports.approveLoan = catchAsync(async (req, res, next) => {
    req.body = req.body || {};
    req.body.status = 'approved';
    return exports.reviewLoan(req, res, next);
});

exports.rejectLoan = catchAsync(async (req, res, next) => {
    req.body = req.body || {};
    req.body.status = 'rejected';
    return exports.reviewLoan(req, res, next);
});



/**
 * @swagger
 * /api/v1/loans/{id}/disburse:
 *   post:
 *     summary: Disburse an approved loan to member's account via Paystack
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 */
exports.disburseLoan = catchAsync(async (req, res, next) => {
    const { mode } = req.body; // mode: 'paystack', 'manual', or 'internal' (direct to savings)

    const loan = await Loan.findByPk(req.params.id, {
        include: [{ model: User, as: 'borrower' }]
    });

    if (!loan) {
        return next(new AppError('Loan not found', 404));
    }

    if (loan.status !== 'approved') {
        return next(new AppError('Only approved loans can be disbursed', 400));
    }

    const t = await sequelize.transaction();
    const loanId = req.params.id;

    try {
        let transferRef = `DSB-${loanId}-${Date.now()}`;
        let recipientCode = null;

        if (mode === 'paystack') {
            // --- Automated Paystack Flow (external bank transfer) ---
            const destBank = loan.bankName || loan.borrower.bankName;
            const destAccount = loan.accountNumber || loan.borrower.accountNumber;

            if (!destBank || !destAccount) {
                return next(new AppError('Borrower bank details missing. Please update loan or user profile.', 400));
            }

            const bankNameLower = destBank.toLowerCase();
            let bankCode = '057'; // Default Zenith
            if (bankNameLower.includes('gtb') || bankNameLower.includes('guaranty')) bankCode = '058';
            if (bankNameLower.includes('zenith')) bankCode = '057';
            if (bankNameLower.includes('access')) bankCode = '044';
            if (bankNameLower.includes('first')) bankCode = '011';
            if (bankNameLower.includes('union')) bankCode = '032';

            const recipient = await PaystackService.createTransferRecipient(
                loan.borrower.name,
                destAccount,
                bankCode
            );

            const amountKobo = Math.round(loan.loanAmount * 100);
            const transfer = await PaystackService.initiateTransfer(
                amountKobo,
                recipient.recipient_code,
                `Loan Disbursement - ${loan.id}`
            );

            transferRef = transfer.reference;
            recipientCode = recipient.recipient_code;
        }
        // For mode === 'manual' or mode === 'internal' (or anything else),
        // we skip Paystack and credit the member's savings account directly.

        // --- ACCOUNTING LOGIC ---

        // 1. Find the Borrower's Primary Savings Account
        const borrowerAccount = await Account.findOne({
            where: { userId: loan.userId, accountType: 'savings' },
            transaction: t,
            lock: t.LOCK.UPDATE
        });

        if (!borrowerAccount) {
            throw new AppError('Borrower does not have a primary savings account to receive funds.', 404);
        }

        // 2. Find the Admin Pool Account (System Treasury)
        const adminPoolAccount = await getTreasuryAccount(loan.institutionId, t);

        if (!adminPoolAccount) {
            throw new AppError('Cooperative Treasury account not found.', 404);
        }

        // Verify Pool Balance
        if (parseFloat(adminPoolAccount.balance) < parseFloat(loan.loanAmount)) {
            throw new AppError('Insufficient funds in Cooperative Pool for this disbursement.', 400);
        }

        // 3. Status Update for Loan
        const disbursedAt = new Date();
        const loanCalculator = require('../utils/loanCalculator');
        const dueDate = loanCalculator.calculateDueDate(disbursedAt, loan.duration);

        await loan.update({
            status: 'disbursed',
            disbursedAt,
            nextPaymentDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
            dueDate,
            originalDueDate: dueDate,
            paystackTransferRecipient: recipientCode,
            disbursementReference: transferRef
        }, { transaction: t });

        // 4. Perform Double-Entry Transactions
        // Credit the Member's savings account
        await recordTransaction({
            accountId: borrowerAccount.id,
            transactionType: 'loan_disbursement',
            amount: loan.loanAmount,
            description: `Loan Disbursement (${mode || 'internal'}): Loan #${loan.id}`,
            performedBy: req.user.id,
            reference: transferRef,
            t
        });

        // Debit the Admin Pool
        await recordTransaction({
            accountId: adminPoolAccount.id,
            transactionType: 'withdrawal',
            amount: loan.loanAmount,
            description: `Admin Pool Payout: Loan #${loan.id} to ${loan.borrower.name}`,
            performedBy: req.user.id,
            reference: `POOL-${transferRef}`,
            t
        });

        await t.commit();

        logAction(req, 'LOAN_DISBURSEMENT', {
            loanId: loan.id,
            mode,
            amount: loan.loanAmount,
            reference: transferRef
        });

        // --- NOTIFICATIONS ---

        // 1. In-App Notification
        await sendNotification({
            userId: loan.userId,
            title: 'Loan Disbursed',
            message: `The funds for your loan (₦${parseFloat(loan.loanAmount).toLocaleString()}) have been credited to your savings account.`,
            type: 'success',
            link: '/loans/my-loans'
        });

        // 2. Email Notification
        try {
            const borrower = await User.findByPk(loan.userId, { attributes: ['name', 'email'] });
            if (borrower) {
                const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
                await new Email(borrower, `${clientUrl}/loans/my-loans`).sendLoanDisbursement(loan, mode);
            }
        } catch (emailErr) {
            console.error('Loan disbursement email failed:', emailErr.message);
        }

        // 3. Re-fetch fresh account balance for socket update
        const updatedAccount = await Account.findByPk(borrowerAccount.id);

        // 4. Socket real-time update
        socketIO.emitToUser(loan.userId, 'account_sync', {
            type: 'loan_disbursed',
            loanId: loan.id,
            amount: loan.loanAmount,
            newBalance: parseFloat(updatedAccount.balance)
        });

        res.status(200).json({
            status: 'success',
            message: `Loan disbursed successfully. Funds credited to member's savings account.`,
            data: {
                reference: transferRef,
                recipient: recipientCode,
                creditedAccount: borrowerAccount.accountNumber
            }
        });
    } catch (error) {
        if (t && !t.finished) await t.rollback();
        return next(error);
    }
});



/**
 * Cancel a pending loan application (Member)
 */
exports.cancelLoan = catchAsync(async (req, res, next) => {
    const loan = await Loan.findOne({ where: { id: req.params.id, userId: req.user.id } });

    if (!loan) {
        return next(new AppError('Loan not found or does not belong to you', 404));
    }

    if (!['pending', 'requested', 'under_review'].includes(loan.status)) {
        return next(new AppError(`You cannot cancel a loan with status: ${loan.status}`, 400));
    }

    await loan.destroy();

    logAction(req, 'LOAN_CANCELLED_DELETED', { loanId: loan.id, prevStatus: loan.status });

    res.status(200).json({
        status: 'success',
        message: 'Loan request cleared successfully'
    });
});


