const express = require('express');
const transactionController = require('../controllers/transactionController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { transferValidators, withdrawDepositValidators } = require('../middleware/validators');
const { checkIdempotency } = require('../middleware/idempotency');

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Transactions
 *   description: Transaction endpoints (deposits, withdrawals)
 */

// Deposit and withdrawal (staff/admin only)
router.post('/transfer', checkIdempotency, transferValidators, transactionController.transfer);
router.post('/deposit', restrictTo('staff', 'super_admin'), checkIdempotency, withdrawDepositValidators, transactionController.deposit);
router.post('/withdraw', restrictTo('staff', 'super_admin'), checkIdempotency, withdrawDepositValidators, transactionController.withdraw);


// Get transaction history (available to all authenticated users)
router.get('/', transactionController.getAllTransactions);

module.exports = router;
