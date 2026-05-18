const { Transaction, Account, User, sequelize } = require('../models');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const crypto = require('crypto');

/**
 * Handle Paystack Webhooks
 */
exports.handlePaystackWebhook = catchAsync(async (req, res, next) => {
    // 1. Verify Signature
    const secret = process.env.PAYSTACK_SECRET_KEY;

    if (!secret) {
        console.warn('PAYSTACK_SECRET_KEY missing. Skipping webhook verification.');
    } else {
        const signature = req.headers['x-paystack-signature'];
        const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');

        if (signature && signature !== hash) {
            console.error('Invalid Paystack signature');
            return res.status(401).send('Invalid signature');
        }
    }

    const event = req.body;

    // 2. Handle charge.success
    if (event.event === 'charge.success') {
        const { amount, customer, reference, metadata, channel } = event.data;

        // Find user by customer code or email
        const user = await User.findOne({
            where: { paystackCustomerCode: customer.customer_code }
        });

        if (!user) {
            console.error(`User not found for Paystack customer: ${customer.customer_code}`);
            return res.status(200).send(); // Always return 200 to Paystack
        }

        // Find the 'savings' account for this user (default destination for DVAs)
        // Or use metadata if we passed account info
        const account = await Account.findOne({
            where: { userId: user.id, accountType: 'savings' }
        });

        if (!account) {
            console.error(`Savings account not found for User: ${user.id}`);
            return res.status(200).send();
        }

        // Check for idempotency
        const existingTxn = await Transaction.findOne({
            where: { reference: `PAYSTACK-${reference}` }
        });

        if (existingTxn) {
            console.log(`Transaction ${reference} already processed. Skipping.`);
            return res.status(200).send();
        }

        // 3. Process Transaction in a SQL Transaction
        await sequelize.transaction(async (t) => {
            // Convert amount from kobo (Paystack) to Naira
            const amountInNaira = amount / 100;
            const newBalance = parseFloat(account.balance) + amountInNaira;

            // Create Transaction record
            await Transaction.create({
                accountId: account.id,
                userId: user.id,
                transactionType: 'deposit',
                amount: amountInNaira,
                balanceAfter: newBalance, // Added this field
                status: 'completed',
                reference: `PAYSTACK-${reference}`,
                description: `Paystack Transfer via ${channel}`,
                performedBy: user.id,
                transactionDate: new Date()
            }, { transaction: t });

            // Update Account Balance
            account.balance = newBalance;
            await account.save({ transaction: t });
        });

        console.log(`Successfully processed Paystack deposit of ${amount / 100} for User ${user.id}`);
    }

    res.status(200).send();
});
