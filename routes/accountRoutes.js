const express = require('express');
const accountController = require('../controllers/accountController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Accounts
 *   description: Account management endpoints
 */

// Get accounts (Members see their own, Admin/Staff see all)
router.get('/', accountController.getAllAccounts);
router.post('/', restrictTo('super_admin'), accountController.createAccount);

// Get my accounts (all authenticated users)
router.get('/my-accounts', accountController.getMyAccounts);

// Get account by ID
router.get('/:id', accountController.getAccountById);

// Get account statement
router.get('/:id/statement', accountController.getAccountStatement);

// Get user financials (staff/admin only)
router.get('/user/:userId', restrictTo('super_admin', 'institution_admin', 'staff'), accountController.getUserFinancials);

// Admin: Purchase shares for a user
router.post('/shares/purchase', restrictTo('super_admin'), accountController.purchaseShares);

// Member: Buy shares from savings
router.post('/shares/buy-from-savings', accountController.buyFromSavings);

module.exports = router;
