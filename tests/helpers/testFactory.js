/**
 * tests/helpers/testFactory.js
 *
 * Reusable helpers to seed the test database with users,
 * accounts, and JWT tokens so each test suite can get up
 * and running without duplicating setup code.
 */
const jwt = require('jsonwebtoken');
const { Institution, User, Account, Transaction } = require('../../models');
const { generateReference } = require('../../utils/accountHelper');

const getTestInstitution = async () => {
    const [institution] = await Institution.findOrCreate({
        where: { code: 'TESTCOOP' },
        defaults: {
            name: 'Test Cooperative',
            email: 'test@scms.test',
            status: 'active'
        }
    });

    return institution;
};

/**
 * Create a test user and return it with a signed JWT token.
 * @param {object} overrides – override any User fields
 */
const createUser = async (overrides = {}) => {
    const institution = await getTestInstitution();
    const user = await User.create({
        name: 'Test User',
        email: `test_${Date.now()}_${Math.random().toString(36).slice(2)}@scms.test`,
        password: 'Test@1234',
        role: 'member',
        status: 'active',
        isEmailVerified: true,
        institutionId: institution.id,
        ...overrides
    });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    return { user, token };
};

/**
 * Create a test account for a given userId.
 */
const createAccount = async (userId, overrides = {}) => {
    const user = await User.findByPk(userId);
    return Account.create({
        userId,
        institutionId: overrides.institutionId || user?.institutionId,
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
    const account = await Account.findByPk(accountId);
    return Transaction.create({
        accountId,
        institutionId: overrides.institutionId || account?.institutionId,
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

module.exports = { createUser, createAccount, createTransaction, getTestInstitution };
