const crypto = require('crypto');
const { Account, Transaction, User, sequelize } = require('../models');
const catchAsync = require('../utils/catchAsync');
const { recordTransaction } = require('../utils/transactionHelper');

const PAYSTACK_REFERENCE_PREFIX = 'PAYSTACK-';

const sendOk = (res, message = 'ok') => res.status(200).json({ status: 'success', message });

const getRawBody = (req) => {
    if (Buffer.isBuffer(req.body)) return req.body;
    if (typeof req.body === 'string') return Buffer.from(req.body);
    return Buffer.from(JSON.stringify(req.body || {}));
};

const verifySignature = (rawBody, signature) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;

    if (!secret || !secret.startsWith('sk_')) {
        if (process.env.NODE_ENV === 'production') {
            return { ok: false, reason: 'Paystack secret key is not configured' };
        }

        console.warn('[PaystackWebhook] PAYSTACK_SECRET_KEY missing/invalid; accepting webhook in non-production mode.');
        return { ok: true };
    }

    if (!signature) {
        return { ok: false, reason: 'Missing Paystack signature' };
    }

    const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    const actualBuffer = Buffer.from(signature, 'hex');

    if (expectedBuffer.length !== actualBuffer.length) {
        return { ok: false, reason: 'Invalid Paystack signature length' };
    }

    if (!crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
        return { ok: false, reason: 'Invalid Paystack signature' };
    }

    return { ok: true };
};

const parseEvent = (rawBody) => {
    try {
        return JSON.parse(rawBody.toString('utf8'));
    } catch (err) {
        return null;
    }
};

const getMetadataValue = (metadata, key) => {
    if (!metadata) return null;

    if (metadata[key] !== undefined && metadata[key] !== null) {
        return metadata[key];
    }

    const field = metadata.custom_fields?.find((item) => item.variable_name === key);
    return field?.value ?? null;
};

const findTargetAccount = async (paymentData, transaction) => {
    const metadata = paymentData.metadata || {};
    const accountId = getMetadataValue(metadata, 'accountId') || getMetadataValue(metadata, 'account_id');

    if (accountId) {
        const account = await Account.findOne({
            where: { id: accountId, status: 'active' },
            transaction
        });
        if (account) return account;
    }

    const customerCode = paymentData.customer?.customer_code;
    if (customerCode) {
        const user = await User.findOne({
            where: { paystackCustomerCode: customerCode },
            transaction
        });

        if (user) {
            return Account.findOne({
                where: { userId: user.id, accountType: 'savings', status: 'active' },
                transaction
            });
        }
    }

    return null;
};

/**
 * Handle Paystack Webhooks.
 *
 * Paystack expects a 200 response once a valid event has been received. For
 * business-rule misses like "account not found", we log and return 200 so
 * Paystack does not keep retrying an event we cannot apply automatically.
 */
exports.handlePaystackWebhook = catchAsync(async (req, res) => {
    const rawBody = getRawBody(req);
    const signature = req.headers['x-paystack-signature'];

    const signatureResult = verifySignature(rawBody, signature);
    if (!signatureResult.ok) {
        console.warn(`[PaystackWebhook] ${signatureResult.reason}`);
        return res.status(401).json({ status: 'fail', message: 'Invalid signature' });
    }

    const event = parseEvent(rawBody);
    if (!event || !event.event || !event.data) {
        console.warn('[PaystackWebhook] Malformed event payload');
        return res.status(400).json({ status: 'fail', message: 'Malformed payload' });
    }

    if (event.event !== 'charge.success') {
        console.log(`[PaystackWebhook] Ignored event: ${event.event}`);
        return sendOk(res, 'event ignored');
    }

    const paymentData = event.data;
    const reference = paymentData.reference;
    const amountInKobo = Number(paymentData.amount);
    const paidStatus = paymentData.status || paymentData.gateway_response;

    if (!reference || !Number.isFinite(amountInKobo) || amountInKobo <= 0) {
        console.warn('[PaystackWebhook] charge.success missing reference or valid amount');
        return sendOk(res, 'invalid charge data ignored');
    }

    if (paymentData.status && paymentData.status !== 'success') {
        console.log(`[PaystackWebhook] Ignored non-success charge ${reference}: ${paidStatus}`);
        return sendOk(res, 'non-success charge ignored');
    }

    const transactionReference = `${PAYSTACK_REFERENCE_PREFIX}${reference}`;

    const existingTxn = await Transaction.findOne({
        where: { reference: transactionReference }
    });

    if (existingTxn) {
        console.log(`[PaystackWebhook] Duplicate event skipped: ${reference}`);
        return sendOk(res, 'already processed');
    }

    const dbTransaction = await sequelize.transaction();

    try {
        const account = await findTargetAccount(paymentData, dbTransaction);

        if (!account) {
            await dbTransaction.rollback();
            console.warn(`[PaystackWebhook] No active target account found for ${reference}`);
            return sendOk(res, 'target account not found');
        }

        const amountInNaira = amountInKobo / 100;

        const txn = await recordTransaction({
            accountId: account.id,
            transactionType: 'deposit',
            amount: amountInNaira,
            description: `Paystack Deposit: ${reference}`,
            performedBy: account.userId,
            reference: transactionReference,
            t: dbTransaction
        });

        await dbTransaction.commit();

        console.log(
            `[PaystackWebhook] Credited ${amountInNaira} to account ${account.id} via ${reference}`
        );

        return sendOk(res, `processed ${txn.reference}`);
    } catch (error) {
        await dbTransaction.rollback();

        if (error.name === 'SequelizeUniqueConstraintError') {
            console.log(`[PaystackWebhook] Reference processed concurrently: ${reference}`);
            return sendOk(res, 'already processed');
        }

        throw error;
    }
});
