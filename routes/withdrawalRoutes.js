const express = require('express');
const withdrawalController = require('../controllers/withdrawalController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Withdrawals
 *   description: Savings withdrawal request management
 */

router.use(protect);

// Member routes
/**
 * @swagger
 * /api/v1/withdrawals/request:
 *   post:
 *     summary: Request a withdrawal from savings
 *     tags: [Withdrawals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Withdrawal requested successfully
 */
router.post('/request', withdrawalController.requestWithdrawal);

/**
 * @swagger
 * /api/v1/withdrawals/my-requests:
 *   get:
 *     summary: Get member's own withdrawal requests
 *     tags: [Withdrawals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Withdrawal requests retrieved successfully
 */
router.get('/my-requests', withdrawalController.getMyWithdrawals);

/**
 * @swagger
 * /api/v1/withdrawals/{id}/cancel:
 *   post:
 *     summary: Cancel a pending withdrawal request
 *     tags: [Withdrawals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Withdrawal request cancelled successfully
 */
router.post('/:id/cancel', withdrawalController.cancelWithdrawal);

// Admin/Staff routes
/**
 * @swagger
 * /api/v1/withdrawals/queue:
 *   get:
 *     summary: Get all pending withdrawal requests (Admin/Staff)
 *     tags: [Withdrawals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Withdrawal queue retrieved successfully
 */
router.get('/queue', restrictTo('super_admin', 'institution_admin', 'staff'), withdrawalController.getWithdrawalQueue);

/**
 * @swagger
 * /api/v1/withdrawals/{id}/process:
 *   patch:
 *     summary: Approve or reject a withdrawal request (Admin/Staff)
 *     tags: [Withdrawals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Withdrawal request processed successfully
 */
router.patch('/:id/process', restrictTo('super_admin', 'institution_admin'), withdrawalController.processWithdrawal);

module.exports = router;
