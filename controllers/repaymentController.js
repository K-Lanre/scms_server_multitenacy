const { Op } = require('sequelize');
const { Loan, LoanRepayment, Account, Transaction, sequelize, User } = require('../models');
const { recordTransaction } = require('../utils/transactionHelper');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { formatAmount } = require('../utils/accountHelper');
const { logAction } = require('../utils/auditLogger');
const Email = require('../utils/email');
const { sendNotification } = require('../utils/notificationService');
const socketIO = require('../utils/socket');
const { attachInstitution } = require('../middleware/tenantMiddleware');

/**
 * @swagger
 * /api/v1/loans/{id}/repay:
 *   post:
 *     summary: Make a manual loan repayment
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Repayment amount
 *     responses:
 *       200:
 *         description: Repayment successful
 */
exports.makeManualRepayment = catchAsync(async (req, res, next) => {
    const { amount, paymentMethod } = req.body;
    const loanId = req.params.id;

    if (!amount || amount <= 0) {
        return next(new AppError('Repayment amount must be greater than 0', 400));
    }

    const loan = await Loan.findOne({
        where: { id: loanId, ...attachInstitution(req) },
        include: [{ model: User, as: 'borrower', attributes: ['id', 'name', 'email'] }]
    });
    if (!loan) {
        return next(new AppError('Loan not found', 404));
    }

    // Only allow repayment for disbursed or repaying loans
    if (loan.status !== 'disbursed' && loan.status !== 'repaying' && loan.status !== 'defaulted') {
        return next(new AppError(`Cannot make repayment for loan in ${loan.status} status`, 400));
    }

    // Verify user owns the loan or is staff
    if (loan.userId !== req.user.id && !['staff', 'institution_admin', 'super_admin'].includes(req.user.role)) {
        return next(new AppError('You can only make payments on your own loans', 403));
    }

    // Identify if the actor is an admin/staff
    const isAdmin = ['staff', 'institution_admin', 'super_admin'].includes(req.user.role);

    // Find member's savings account
    const account = await Account.findOne({
        where: { userId: loan.userId, accountType: 'savings' }
    });

    if (!account) {
        return next(new AppError('Borrower savings account not found', 404));
    }

    // Check sufficient balance ONLY if it's a member paying for themselves
    if (!isAdmin && parseFloat(account.balance) < parseFloat(amount)) {
        return next(new AppError(`Insufficient balance. You have ₦${account.balance}, but trying to pay ₦${amount}`, 400));
    }

    const t = await sequelize.transaction();

    try {
        // 1. Calculate principal and interest portions
        const principalPortion = (parseFloat(amount) * parseFloat(loan.loanAmount)) / parseFloat(loan.totalRepayable);
        const interestPortion = parseFloat(amount) - principalPortion;

        let financialTransaction;
        // Default payment method if not provided
        const method = paymentMethod || (isAdmin ? 'Cash' : 'Savings Account');

        if (isAdmin) {
            // ADMIN CASE: Member brought cash. Record transaction but DO NOT change account balance.
            financialTransaction = await Transaction.create({
                accountId: account.id,
                institutionId: req.user.institutionId,
                transactionType: 'loan_repayment',
                amount: formatAmount(amount),
                balanceAfter: account.balance, // No change to savings balance
                reference: `CASH_${Date.now()}`,
                description: `Loan repayment for Loan #${loan.id} (Via: ${method})`,
                performedBy: req.user.id,
                status: 'completed',
                completedAt: new Date()
            }, { transaction: t });

            // Note: We do NOT call account.update() here
        } else {
            // MEMBER CASE: Auto-debit from their own savings account.
            const newBalance = parseFloat(account.balance) - parseFloat(amount);

            financialTransaction = await Transaction.create({
                accountId: account.id,
                institutionId: req.user.institutionId,
                transactionType: 'loan_repayment',
                amount: formatAmount(amount),
                balanceAfter: formatAmount(newBalance),
                reference: `REPAY_${Date.now()}`,
                description: `Loan repayment for Loan #${loan.id} (Via: ${method})`,
                performedBy: req.user.id,
                status: 'completed',
                completedAt: new Date()
            }, { transaction: t });

            // Update account balance
            await account.update({
                balance: formatAmount(newBalance)
            }, { transaction: t });
        }

        // 3. Create LoanRepayment record
        await LoanRepayment.create({
            loanId: loan.id,
            transactionId: financialTransaction.id,
            amount: formatAmount(amount),
            principal: formatAmount(principalPortion),
            interest: formatAmount(interestPortion),
            paidAt: new Date()
        }, { transaction: t });

        // 4. Update Loan balance and status
        const newOutstanding = parseFloat(loan.outstandingBalance) - parseFloat(amount);
        const newStatus = newOutstanding <= 0 ? 'completed' : 'repaying';

        // Reset failed deduction count on successful payment
        await loan.update({
            outstandingBalance: formatAmount(Math.max(0, newOutstanding)),
            status: newStatus,
            failedDeductionCount: 0,
            lastDeductionDate: new Date(),
            completedAt: newStatus === 'completed' ? new Date() : loan.completedAt
        }, { transaction: t });

        await t.commit();

        // 5. Notifications & Alerts
        const admins = await User.findAll({
            where: { role: { [Op.in]: ['institution_admin', 'super_admin', 'staff'] }, status: 'active' }
        });

        // Notify all admins of the successful payment (General Alert)
        for (const admin of admins) {
            await sendNotification({
                userId: admin.id,
                title: 'Loan Repayment Received 💳',
                message: `${loan.borrower?.name || 'A member'} paid ₦${parseFloat(amount).toLocaleString()} on Loan #${loan.id}.`,
                type: 'info',
                link: `/admin/loan-portfolio`
            });
        }

        if (newStatus === 'completed') {
            // Notify admins that a loan has been fully paid
            for (const admin of admins) {
                await sendNotification({
                    userId: admin.id,
                    title: 'Loan Fully Repaid 💰',
                    message: `${loan.borrower?.name || 'Member ' + loan.userId} has successfully paid off Loan #${loan.id}. Total amount: ₦${parseFloat(loan.totalRepayable).toLocaleString()}.`,
                    type: 'success',
                    link: `/admin/loan-portfolio`
                });
            }

            // Also notify the member
            await sendNotification({
                userId: loan.userId,
                title: 'Congratulations! Loan Completed 🎉',
                message: `You have successfully fully repaid your loan (Loan #${loan.id}). Your financial record has been updated.`,
                type: 'success',
                link: '/loans/my-loans'
            });
        }

        // Trigger real-time UI refresh for member on any repayment
        socketIO.emitToUser(loan.userId, 'account_sync', {
            type: 'loan_repayment',
            loanId: loan.id,
            amount,
            status: newStatus
        });

        // 5. Send Email Alert (Async)
        try {
            const user = await User.findByPk(req.user.id);
            if (user && user.email) {
                const email = new Email(user, `${process.env.FRONTEND_URL}/loans/repayments/${loan.id}`);
                email.sendTransactionAlert(financialTransaction, account, 'Debit');
            }
        } catch (emailErr) {
            console.error('Email alert failed:', emailErr);
        }

        logAction(req, 'LOAN_REPAYMENT', { loanId: loan.id, amount, newOutstanding });

        res.status(200).json({
            status: 'success',
            message: newStatus === 'completed' ? 'Loan fully repaid!' : 'Payment successful',
            data: {
                loan: {
                    id: loan.id,
                    outstandingBalance: formatAmount(Math.max(0, newOutstanding)),
                    status: newStatus
                },
                repayment: {
                    amount: formatAmount(amount),
                    principal: formatAmount(principalPortion),
                    interest: formatAmount(interestPortion)
                }
            }
        });
    } catch (error) {
        await t.rollback();
        return next(error);
    }
});

/**
 * @swagger
 * /api/v1/loans/{id}/repayments:
 *   get:
 *     summary: Get repayment history for a loan
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Repayment history retrieved
 */
exports.getRepaymentHistory = catchAsync(async (req, res, next) => {
    const loanId = req.params.id;

    const loan = await Loan.findOne({
        where: { id: loanId, ...attachInstitution(req) },
        include: [
            { model: User, as: 'borrower', attributes: ['name', 'email'] },
            { model: User, as: 'approver', attributes: ['name', 'email'] }
        ]
    });
    if (!loan) {
        return next(new AppError('Loan not found', 404));
    }

    // Allow user to see their own loans, or staff/admin to see all
    if (loan.userId !== req.user.id && !['staff', 'super_admin'].includes(req.user.role)) {
        return next(new AppError('You can only view your own loan history', 403));
    }

    const repayments = await LoanRepayment.findAll({
        where: { loanId },
        include: [{
            model: Transaction,
            as: 'transaction',
            attributes: ['reference', 'createdAt', 'status']
        }],
        order: [['paidAt', 'DESC']]
    });

    res.status(200).json({
        status: 'success',
        results: repayments.length,
        data: {
            loan,
            repayments
        }
    });
});

/**
 * Common: Get repayment history for ALL loans of the logged-in user
 * GET /api/v1/loans/repayments/my-history
 */
exports.getMyTotalRepaymentHistory = catchAsync(async (req, res, next) => {
    const repayments = await LoanRepayment.findAll({
        include: [
            {
                model: Loan,
                as: 'loan',
                where: { userId: req.user.id, ...attachInstitution(req) },
                attributes: ['id', 'loanAmount', 'status', 'loanType']
            },
            {
                model: Transaction,
                as: 'transaction',
                attributes: ['reference', 'createdAt', 'status', 'description']
            }
        ],
        order: [['paidAt', 'DESC']]
    });

    res.status(200).json({
        status: 'success',
        results: repayments.length,
        data: {
            repayments
        }
    });
});
