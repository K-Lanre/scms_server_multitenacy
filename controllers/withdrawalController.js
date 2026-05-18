const { WithdrawalRequest, Account, User, Transaction, sequelize } = require('../models');
const { Op } = require('sequelize');
const { recordTransaction } = require('../utils/transactionHelper');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { logAction } = require('../utils/auditLogger');
const socketIO = require('../utils/socket');
const { sendNotification } = require('../utils/notificationService');
const Email = require('../utils/email');


exports.requestWithdrawal = catchAsync(async (req, res, next) => {
    const { accountId, amount, reason, recipientName, recipientAccount, recipientBank } = req.body;

    if (!accountId || !amount) {
        return next(new AppError('Account ID and amount are required', 400));
    }

    if (amount <= 0) {
        return next(new AppError('Amount must be greater than 0', 400));
    }

    // 1) Check if account exists and belongs to the user
    const account = await Account.findOne({
        where: { id: accountId, userId: req.user.id }
    });

    if (!account) {
        return next(new AppError('Account not found or does not belong to you', 404));
    }

    // 2) Validate balance
    if (!account.canWithdraw(amount)) {
        return next(new AppError('Insufficient balance or account is not active', 400));
    }

    // 3) Check if auto-approval applies (below ₦500,000)
    const AUTO_APPROVE_LIMIT = 500000;
    const shouldAutoApprove = parseFloat(amount) < AUTO_APPROVE_LIMIT;

    // 4) Create request
    const isExternal = !!(recipientName && recipientAccount && recipientBank);
    const request = await WithdrawalRequest.create({
        userId: req.user.id,
        accountId,
        amount,
        reason,
        status: shouldAutoApprove ? 'approved' : 'pending',
        recipientName: recipientName || null,
        recipientAccount: recipientAccount || null,
        recipientBank: recipientBank || null,
        isExternalTransfer: isExternal,
        institutionId: req.user.institutionId
    });

    logAction(req, 'WITHDRAWAL_REQUEST', { requestId: request.id, amount: request.amount, autoApproved: shouldAutoApprove });

    if (shouldAutoApprove) {
        // Auto-approve: process the withdrawal immediately
        const t = await sequelize.transaction();
        try {
            // Record transaction (debit the account)
            await recordTransaction({
                accountId: account.id,
                transactionType: 'withdrawal',
                amount: request.amount,
                description: `Withdrawal: ${reason || 'Cash withdrawal'}`,
                performedBy: req.user.id,
                t
            });

            // Update request status
            request.processedBy = req.user.id;
            request.processedAt = new Date();
            await request.save({ transaction: t });

            await t.commit();

            // Send notification to user
            await sendNotification({
                userId: req.user.id,
                title: 'Withdrawal Processed ',
                message: `Your withdrawal of ₦${parseFloat(request.amount).toLocaleString()} has been processed successfully.`,
                type: 'success',
                link: '/savings/withdrawal'
            });

            // 2) Email Notification
            try {
                await new Email(req.user, '').sendWithdrawalApproval(request.amount, reason);
            } catch (err) {
                console.error('Auto-approval email failed:', err.message);
            }

            // Re-fetch fresh account balance for socket update
            const updatedAccount = await Account.findByPk(account.id);

            // Real-time balance update
            socketIO.emitToUser(req.user.id, 'account_sync', {
                type: 'withdrawal_processed',
                requestId: request.id,
                amount: request.amount,
                newBalance: parseFloat(updatedAccount.balance)
            });

            return res.status(201).json({
                status: 'success',
                message: `Withdrawal of ₦${parseFloat(request.amount).toLocaleString()} processed immediately.`,
                data: {
                    request,
                    autoApproved: true
                }
            });
        } catch (err) {
            await t.rollback();
            return next(err);
        }
    }

    // For amounts >= ₦500,000: require admin approval
    // Notify all active admins
    const admins = await User.findAll({
        where: { role: { [Op.in]: ['institution_admin', 'super_admin', 'staff'] }, status: 'active' }
    });

    for (const admin of admins) {
        await sendNotification({
            userId: admin.id,
            title: 'New Withdrawal Request 💸',
            message: `${req.user.name} has requested a withdrawal of ₦${parseFloat(request.amount).toLocaleString()}.`,
            type: 'warning',
            link: `/admin/withdrawals`
        });
    }

    // Real-time dashboard update (broadcast)
    socketIO.emitToAdmins('request_sync', {
        type: 'new_withdrawal_request',
        applicant: req.user.name,
        amount: request.amount
    });

    res.status(201).json({
        status: 'success',
        message: 'Withdrawal request submitted for admin approval (₦500,000 or above).',
        data: {
            request
        }
    });
});

exports.getWithdrawalQueue = catchAsync(async (req, res, next) => {
    const { attachInstitution } = require('../middleware/tenantMiddleware');
    const requests = await WithdrawalRequest.findAll({
        include: [
            {
                model: User,
                as: 'user',
                attributes: ['id', 'name', 'email', 'profilePicture'],
                where: attachInstitution(req)
            },
            {
                model: Account,
                as: 'account',
                attributes: ['id', 'accountNumber', 'accountType', 'balance']
            }
        ],
        order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
        status: 'success',
        results: requests.length,
        data: {
            requests
        }
    });
});

exports.processWithdrawal = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
        return next(new AppError('Invalid status. Use approved or rejected', 400));
    }

    const request = await WithdrawalRequest.findByPk(id, {
        include: [{ model: Account, as: 'account' }]
    });

    if (!request) {
        return next(new AppError('Withdrawal request not found', 404));
    }

    if (request.status !== 'pending') {
        return next(new AppError(`Request already ${request.status}`, 400));
    }

    if (status === 'rejected') {
        if (!rejectionReason) {
            return next(new AppError('Rejection reason is required', 400));
        }

        request.status = 'rejected';
        request.rejectionReason = rejectionReason;
        request.processedBy = req.user.id;
        request.processedAt = new Date();
        await request.save();

        logAction(req, 'WITHDRAWAL_REJECTED', { requestId: request.id, reason: rejectionReason });

        // Socket real-time update
        socketIO.emitToUser(request.userId, 'account_sync', {
            type: 'withdrawal_rejected',
            requestId: request.id,
            reason: rejectionReason
        });

        // 1) Persistent In-App Notification
        await sendNotification({
            userId: request.userId,
            title: 'Withdrawal Rejected ❌',
            message: `Your withdrawal request for ₦${parseFloat(request.amount).toLocaleString()} was rejected. Reason: ${rejectionReason}`,
            type: 'error',
            link: '/savings/withdrawal'
        });

        // 2) Email Notification
        const user = await User.findByPk(request.userId);
        if (user) {
            try {
                await new Email(user, '').sendWithdrawalRejection(request.amount, rejectionReason);
            } catch (err) {
                console.error('Email rejection failed:', err.message);
            }
        }

        return res.status(200).json({
            status: 'success',
            data: { request }
        });
    }

    // Process Approval
    const t = await sequelize.transaction();

    try {
        const account = request.account;

        // Double check balance inside transaction
        if (!account.canWithdraw(request.amount)) {
            throw new AppError('Insufficient balance for this withdrawal', 400);
        }

        // 1) Record transaction (this helper should handle balance update)
        const transaction = await recordTransaction({
            accountId: account.id,
            transactionType: 'withdrawal',
            amount: request.amount,
            description: `Withdrawal: ${request.reason || 'Cash withdrawal'}`,
            performedBy: req.user.id,
            t
        });

        // 2) Update request status
        request.status = 'approved';
        request.processedBy = req.user.id;
        request.processedAt = new Date();

        // 3) Attempt Paystack Transfer if bank details are available
        const user = await User.findByPk(request.userId);
        if (user.accountNumber && user.bankCode) {
            try {
                const PaystackService = require('../services/paystackService');

                // Create recipient or use existing
                let recipientCode = user.paystackRecipientCode;
                if (!recipientCode) {
                    const recipient = await PaystackService.createTransferRecipient(user.name, user.accountNumber, user.bankCode);
                    recipientCode = recipient.recipient_code;
                    user.paystackRecipientCode = recipientCode;
                    await user.save({ transaction: t });
                }

                // Initiate transfer (amount in kobo)
                const transfer = await PaystackService.initiateTransfer(
                    request.amount * 100,
                    recipientCode,
                    `Withdrawal Approval: ${request.id}`
                );

                request.paystackTransferReference = transfer.reference;
                console.log(`[Paystack] Transfer initiated: ${transfer.reference}`);
            } catch (paystackErr) {
                console.error('[Paystack] Transfer failed:', paystackErr.message);
                // We don't necessarily fail the whole transaction if Paystack fails, 
                // but in a production app you might want to.
                // For now, we'll log it and proceed with the ledger update.
            }
        }

        await request.save({ transaction: t });

        await t.commit();

        logAction(req, 'WITHDRAWAL_APPROVED', {
            requestId: request.id,
            amount: request.amount,
            payoutTriggered: !!request.paystackTransferReference
        });

        // Socket real-time update to user
        socketIO.emitToUser(request.userId, 'account_sync', {
            type: 'withdrawal_approved',
            requestId: request.id,
            amount: request.amount
        });

        // Socket real-time update to admins
        socketIO.emitToAdmins('withdrawal_updated', {
            requestId: request.id,
            status: 'approved',
            amount: request.amount,
            userId: request.userId
        });

        // 1) Persistent In-App Notification for Member
        await sendNotification({
            userId: request.userId,
            title: 'Withdrawal Approved ✅',
            message: `Your withdrawal of ₦${parseFloat(request.amount).toLocaleString()} has been approved and processed.`,
            type: 'success',
            link: '/savings/withdrawal'
        });

        // 2) Email Notification for Member
        try {
            await new Email(user, '').sendWithdrawalApproval(request.amount, request.reason);
        } catch (err) {
            console.error('Email approval failed:', err.message);
        }

        res.status(200).json({
            status: 'success',
            data: {
                request,
                transaction
            }
        });
    } catch (err) {
        await t.rollback();
        next(err);
    }
});

exports.getMyWithdrawals = catchAsync(async (req, res, next) => {
    const requests = await WithdrawalRequest.findAll({
        where: { userId: req.user.id },
        order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
        status: 'success',
        results: requests.length,
        data: {
            requests
        }
    });
});

exports.cancelWithdrawal = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const request = await WithdrawalRequest.findOne({
        where: { id, userId: req.user.id, status: 'pending' }
    });

    if (!request) {
        return next(new AppError('Withdrawal request not found or cannot be cancelled', 404));
    }

    request.status = 'cancelled';
    await request.save();

    res.status(200).json({
        status: 'success',
        data: {
            request
        }
    });
});
