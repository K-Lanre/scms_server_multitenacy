/**
 * tests/transactions.test.js
 *
 * Integration tests for the transaction endpoints:
 *   POST /api/v1/transactions/transfer      – inter-account transfer
 *   POST /api/v1/transactions/deposit       – staff deposit
 *   POST /api/v1/transactions/withdraw      – staff withdrawal
 *   GET  /api/v1/transactions               – list transactions
 *
 * Uses in-memory SQLite (set up via tests/setup.js).
 */
require('./setup');

const request = require('supertest');
const app = require('../app');
const { createUser, createAccount, createTransaction } = require('./helpers/testFactory');

// ─────────────────────────────────────────────
// TRANSFER Tests
// ─────────────────────────────────────────────
describe('POST /api/v1/transactions/transfer', () => {
    let senderToken, sender, senderAccount;
    let receiverAccount;

    beforeEach(async () => {
        ({ user: sender, token: senderToken } = await createUser({ email: `sender_${Date.now()}@test.com` }));
        const { user: receiver } = await createUser({ email: `receiver_${Date.now()}@test.com` });

        senderAccount = await createAccount(sender.id, { balance: 10000.00 });
        receiverAccount = await createAccount(receiver.id, { balance: 2000.00 });
    });

    it('401 – rejects unauthenticated requests', async () => {
        const res = await request(app)
            .post('/api/v1/transactions/transfer')
            .send({ fromAccountId: senderAccount.id, toAccountNumber: receiverAccount.accountNumber, amount: 500 });

        expect(res.status).toBe(401);
    });

    it('400 – rejects missing required fields', async () => {
        const res = await request(app)
            .post('/api/v1/transactions/transfer')
            .set('Authorization', `Bearer ${senderToken}`)
            .send({ fromAccountId: senderAccount.id });  // missing toAccountNumber and amount

        expect(res.status).toBe(400);
        expect(res.body.status).toBe('error');
        expect(res.body.errors).toBeDefined();
    });

    it('400 – rejects negative amount ', async () => {
        const res = await request(app)
            .post('/api/v1/transactions/transfer')
            .set('Authorization', `Bearer ${senderToken}`)
            .send({ fromAccountId: senderAccount.id, toAccountNumber: receiverAccount.accountNumber, amount: -100 });

        expect(res.status).toBe(400);
    });

    it('400 – rejects zero amount', async () => {
        const res = await request(app)
            .post('/api/v1/transactions/transfer')
            .set('Authorization', `Bearer ${senderToken}`)
            .send({ fromAccountId: senderAccount.id, toAccountNumber: receiverAccount.accountNumber, amount: 0 });

        expect(res.status).toBe(400);
    });

    it('400 – rejects invalid purpose', async () => {
        const res = await request(app)
            .post('/api/v1/transactions/transfer')
            .set('Authorization', `Bearer ${senderToken}`)
            .send({
                fromAccountId: senderAccount.id,
                toAccountNumber: receiverAccount.accountNumber,
                amount: 500,
                purpose: 'invalid_purpose_xyz'
            });

        expect(res.status).toBe(400);
    });

    it('404 – rejects transfer from non-owned account', async () => {
        const { user: other } = await createUser({ email: `other_${Date.now()}@test.com` });
        const otherAccount = await createAccount(other.id);

        const res = await request(app)
            .post('/api/v1/transactions/transfer')
            .set('Authorization', `Bearer ${senderToken}`)
            .send({ fromAccountId: otherAccount.id, toAccountNumber: receiverAccount.accountNumber, amount: 500 });

        expect(res.status).toBe(404);
    });

    it('400 – rejects transfer when source is a share_capital account', async () => {
        const shareCapitalAccount = await createAccount(sender.id, { accountType: 'share_capital' });

        const res = await request(app)
            .post('/api/v1/transactions/transfer')
            .set('Authorization', `Bearer ${senderToken}`)
            .send({ fromAccountId: shareCapitalAccount.id, toAccountNumber: receiverAccount.accountNumber, amount: 500 });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/share capital/i);
    });

    it('400 – rejects transfer to share_capital account', async () => {
        const { user: other } = await createUser({ email: `shcap_${Date.now()}@test.com` });
        const shareCapitalDest = await createAccount(other.id, { accountType: 'share_capital' });

        const res = await request(app)
            .post('/api/v1/transactions/transfer')
            .set('Authorization', `Bearer ${senderToken}`)
            .send({ fromAccountId: senderAccount.id, toAccountNumber: shareCapitalDest.accountNumber, amount: 500 });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/share capital/i);
    });

    it('400 – rejects transfer when insufficient balance', async () => {
        const res = await request(app)
            .post('/api/v1/transactions/transfer')
            .set('Authorization', `Bearer ${senderToken}`)
            .send({ fromAccountId: senderAccount.id, toAccountNumber: receiverAccount.accountNumber, amount: 999999 });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/insufficient balance/i);
    });

    it('400 – rejects self-transfer', async () => {
        const res = await request(app)
            .post('/api/v1/transactions/transfer')
            .set('Authorization', `Bearer ${senderToken}`)
            .send({ fromAccountId: senderAccount.id, toAccountNumber: senderAccount.accountNumber, amount: 500 });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/same account/i);
    });

    it('200 – succeeds and records linked transfer transactions', async () => {
        const res = await request(app)
            .post('/api/v1/transactions/transfer')
            .set('Authorization', `Bearer ${senderToken}`)
            .send({
                fromAccountId: senderAccount.id,
                toAccountNumber: receiverAccount.accountNumber,
                amount: 1000,
                purpose: 'savings',
                description: 'Test transfer'
            });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data.reference).toBeDefined();
        expect(res.body.data.linkedTransactionId).toBeDefined();
        expect(res.body.data.purpose).toBe('savings');

        // Verify balances were updated
        const { Account } = require('../models');
        const updatedSender = await Account.findByPk(senderAccount.id);
        const updatedReceiver = await Account.findByPk(receiverAccount.id);

        expect(parseFloat(updatedSender.balance)).toBe(9000);
        expect(parseFloat(updatedReceiver.balance)).toBe(3000);
    });

    it('200 – idempotency key prevents double spend', async () => {
        const payload = {
            fromAccountId: senderAccount.id,
            toAccountNumber: receiverAccount.accountNumber,
            amount: 500
        };

        // First request
        const res1 = await request(app)
            .post('/api/v1/transactions/transfer')
            .set('Authorization', `Bearer ${senderToken}`)
            .set('Idempotency-Key', 'unique-test-key-001')
            .send(payload);

        expect(res1.status).toBe(200);

        // Identical second request with same key — should return cached response, not double-debit
        const res2 = await request(app)
            .post('/api/v1/transactions/transfer')
            .set('Authorization', `Bearer ${senderToken}`)
            .set('Idempotency-Key', 'unique-test-key-001')
            .send(payload);

        expect(res2.status).toBe(200);
        // Balance should only have been debited once
        const { Account } = require('../models');
        const updatedSender = await Account.findByPk(senderAccount.id);
        expect(parseFloat(updatedSender.balance)).toBe(9500); // 10000 - 500 only once
    });
});

// ─────────────────────────────────────────────
// DEPOSIT Tests (Staff only)
// ─────────────────────────────────────────────
describe('POST /api/v1/transactions/deposit', () => {
    let staffToken, memberAccount;

    beforeEach(async () => {
        const { token } = await createUser({
            email: `staff_${Date.now()}@test.com`,
            role: 'staff',
            status: 'active'
        });
        staffToken = token;

        const { user: member } = await createUser({ email: `member_dep_${Date.now()}@test.com` });
        memberAccount = await createAccount(member.id, { balance: 1000.00 });
    });

    it('403 – rejects deposit by non-staff user', async () => {
        const { token: memberToken } = await createUser({ email: `reg_member_${Date.now()}@test.com` });

        const res = await request(app)
            .post('/api/v1/transactions/deposit')
            .set('Authorization', `Bearer ${memberToken}`)
            .send({ accountId: memberAccount.id, amount: 500 });

        expect(res.status).toBe(403);
    });

    it('400 – rejects deposit with missing amount', async () => {
        const res = await request(app)
            .post('/api/v1/transactions/deposit')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ accountId: memberAccount.id });

        expect(res.status).toBe(400);
        expect(res.body.errors).toBeDefined();
    });

    it('400 – rejects zero or negative deposit amount', async () => {
        const res = await request(app)
            .post('/api/v1/transactions/deposit')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ accountId: memberAccount.id, amount: -50 });

        expect(res.status).toBe(400);
    });

    it('200 – successful deposit increases account balance', async () => {
        const res = await request(app)
            .post('/api/v1/transactions/deposit')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ accountId: memberAccount.id, amount: 2000, description: 'Cash deposit' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data.transaction.amount).toBeDefined();

        const { Account } = require('../models');
        const updated = await Account.findByPk(memberAccount.id);
        expect(parseFloat(updated.balance)).toBe(3000);
    });
});

// ─────────────────────────────────────────────
// WITHDRAWAL Tests (Staff only)
// ─────────────────────────────────────────────
describe('POST /api/v1/transactions/withdraw', () => {
    let staffToken, memberAccount;

    beforeEach(async () => {
        const { token } = await createUser({
            email: `staff_w_${Date.now()}@test.com`,
            role: 'staff',
            status: 'active'
        });
        staffToken = token;

        const { user: member } = await createUser({ email: `member_w_${Date.now()}@test.com` });
        memberAccount = await createAccount(member.id, { balance: 5000.00 });
    });

    it('400 – rejects withdrawal exceeding balance', async () => {
        const res = await request(app)
            .post('/api/v1/transactions/withdraw')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ accountId: memberAccount.id, amount: 99999 });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/insufficient balance/i);
    });

    it('200 – successful withdrawal reduces account balance', async () => {
        const res = await request(app)
            .post('/api/v1/transactions/withdraw')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ accountId: memberAccount.id, amount: 1500, description: 'ATM withdrawal' });

        expect(res.status).toBe(200);

        const { Account } = require('../models');
        const updated = await Account.findByPk(memberAccount.id);
        expect(parseFloat(updated.balance)).toBe(3500);
    });
});

// ─────────────────────────────────────────────
// GET Transactions Tests
// ─────────────────────────────────────────────
describe('GET /api/v1/transactions', () => {
    let memberToken, memberUser, memberAccount;

    beforeEach(async () => {
        ({ user: memberUser, token: memberToken } = await createUser({ email: `member_list_${Date.now()}@test.com` }));
        memberAccount = await createAccount(memberUser.id);
        await createTransaction(memberAccount.id, memberUser.id);
        await createTransaction(memberAccount.id, memberUser.id, { transactionType: 'withdrawal', amount: 200, balanceAfter: 800 });
    });

    it('401 – rejects unauthenticated request', async () => {
        const res = await request(app).get('/api/v1/transactions');
        expect(res.status).toBe(401);
    });

    it('200 – returns transaction list for authenticated user', async () => {
        const res = await request(app)
            .get('/api/v1/transactions')
            .set('Authorization', `Bearer ${memberToken}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('200 – supports type filtering', async () => {
        const res = await request(app)
            .get('/api/v1/transactions?type=deposit')
            .set('Authorization', `Bearer ${memberToken}`);

        expect(res.status).toBe(200);
        res.body.data.forEach(txn => {
            expect(txn.transactionType).toBe('deposit');
        });
    });
});
