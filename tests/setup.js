// tests/setup.js
// Set test environment before anything is loaded
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';

const { sequelize } = require('../models');

// Create all tables before any test runs
beforeAll(async () => {
    await sequelize.sync({ force: true });
});

// Drop all tables after all tests complete
afterAll(async () => {
    await sequelize.drop();
    await sequelize.close();
});
