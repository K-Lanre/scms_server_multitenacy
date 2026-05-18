const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { Account, Transaction } = require('../models');
const { getTreasuryAccount } = require('../utils/treasuryManager');
const fetch = require('node-fetch');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const getHeaders = () => ({
    'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json'
});

exports.getTreasurySummary = catchAsync(async (req, res, next) => {
    const institutionId = req.institutionId;

    if (!institutionId) {
        return next(new AppError('No institution linked to your account.', 400));
    }

    const treasuryAccount = await getTreasuryAccount(institutionId);

    if (!treasuryAccount) {
        return next(new AppError('Failed to retrieve treasury account', 500));
    }

    const recentTransactions = await Transaction.findAll({
        where: { accountId: treasuryAccount.id },
        order: [['createdAt', 'DESC']],
        limit: 10
    });

    res.status(200).json({
        status: 'success',
        data: {
            treasury: {
                accountId: treasuryAccount.id,
                accountNumber: treasuryAccount.accountNumber,
                balance: treasuryAccount.balance
            },
            recentTransactions
        }
    });
});

exports.initializeTreasuryFunding = catchAsync(async (req, res, next) => {
    const institutionId = req.institutionId;
    const { amount } = req.body;

    if (!institutionId) {
        return next(new AppError('No institution linked to your account.', 400));
    }

    if (!amount || amount < 100) {
        return next(new AppError('Minimum deposit amount is ₦100', 400));
    }

    const treasuryAccount = await getTreasuryAccount(institutionId);

    const reference = `TRS_${institutionId}_${Date.now()}`;
    const amountInKobo = Math.round(amount * 100);

    // Mock mode if no Paystack key
    if (!PAYSTACK_SECRET_KEY || !PAYSTACK_SECRET_KEY.startsWith('sk_')) {
        console.warn('[Paystack] Using mock payment initialization for Treasury');
        return res.status(200).json({
            status: 'success',
            data: {
                authorization_url: `${req.get('origin') || 'http://localhost:5173'}/admin/treasury/verify?reference=${reference}&mock=true&accountId=${treasuryAccount.id}&amount=${amount}`,
                reference,
                access_code: 'mock_access',
                isMock: true
            }
        });
    }

    const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/treasury/verify`;

    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
            email: req.user.email, // Use the admin's email for the receipt
            amount: amountInKobo,
            reference,
            callback_url: callbackUrl,
            metadata: {
                accountId: treasuryAccount.id,
                institutionId,
                fundingType: 'treasury',
                custom_fields: [
                    { display_name: 'Treasury Account', variable_name: 'account_id', value: treasuryAccount.id }
                ]
            }
        })
    });

    const result = await response.json();

    if (!result.status) {
        return next(new AppError(`Payment initialization failed: ${result.message}`, 400));
    }

    res.status(200).json({
        status: 'success',
        data: {
            authorization_url: result.data.authorization_url,
            reference: result.data.reference,
            access_code: result.data.access_code
        }
    });
});
