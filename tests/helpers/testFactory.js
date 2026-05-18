/**
 * tests/helpers/testFactory.js
 *
 * Reusable helpers to seed the test database with users,
 * accounts, and JWT tokens so each test suite can get up
 * and running without duplicating setup code.
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Account, Transaction } = require('../../models');
const { generateReference } = require('../../utils/accountHelper');

/**
 * Create a test user and return it with a signed JWT token.
 * @param {object} overrides – override any User fields
 */
const createUser = async (overrides = {}) => {
    const hashedPassword = await bcrypt.hash('Test@1234', 12);
    const user = await User.create({
        name: 'Test User',
        email: `test_${Date.now()}_${Math.random().toString(36).slice(2)}@scms.test`,
        password: hashedPassword,
        role: 'member',
        status: 'active',
        isEmailVerified: true,
        ...overrides
    });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    return { user, token };
};

/**
 * Create a test account for a given userId.
 */
const createAccount = async (userId, overrides = {}) => {
    return Account.create({
        userId,
        accountNumber: `ACC${Date.now()}${Math.floor(Math.random() * 9999)}`,
        accountType: 'savings',
        balance: 50000.00,
        status: 'active',
        ...overrides
    });
};

/**
 * Seed a completed transaction directly
 */
const createTransaction = async (accountId, performedBy, overrides = {}) => {
    return Transaction.create({
        accountId,
        transactionType: 'deposit',
        amount: 1000.00,
        balanceAfter: 51000.00,
        reference: generateReference(),
        description: 'Test seeded transaction',
        performedBy,
        status: 'completed',
        completedAt: new Date(),
        ...overrides
    });
};

module.exports = { createUser, createAccount, createTransaction };
