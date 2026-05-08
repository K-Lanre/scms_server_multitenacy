const express = require('express');
const savingsProductController = require('../controllers/savingsProductController');
const savingsPlanController = require('../controllers/savingsPlanController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Savings
 *   description: Savings products and member plans management
 */

// Public/Member routes
/**
 * @swagger
 * /api/v1/savings/products:
 *   get:
 *     summary: Get all available savings products
 *     tags: [Savings]
 *     responses:
 *       200:
 *         description: Savings products retrieved successfully
 */
router.get('/products', savingsProductController.getAllProducts);

// Plans (Member)
router.use(protect);

/**
 * @swagger
 * /api/v1/savings/plans:
 *   post:
 *     summary: Create a new savings plan (Member)
 *     tags: [Savings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Savings plan created successfully
 */
router.post('/plans', restrictTo('member', 'institution_admin', 'staff'), savingsPlanController.createPlan);

/**
 * @swagger
 * /api/v1/savings/my-plans:
 *   get:
 *     summary: Get member's own savings plans
 *     tags: [Savings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Member's savings plans retrieved successfully
 */
router.get('/my-plans', restrictTo('member', 'institution_admin', 'staff'), savingsPlanController.getMyPlans);
router.get('/plans/:id', restrictTo('member', 'institution_admin', 'staff'), savingsPlanController.getPlan);

/**
 * @swagger
 * /api/v1/savings/plans/{id}/withdraw:
 *   post:
 *     summary: Withdraw funds from a savings plan (Member)
 *     tags: [Savings]
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
 *         description: Withdrawal successful
 */
router.post('/plans/:id/withdraw', restrictTo('member', 'institution_admin', 'staff'), savingsPlanController.withdrawFromPlan);

// Admin only routes
router.get('/products/:id', savingsProductController.getProduct);
router.use(restrictTo('super_admin', 'institution_admin'));

/**
 * @swagger
 * /api/v1/savings/products:
 *   post:
 *     summary: Create a new savings product (Admin/Staff)
 *     tags: [Savings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Savings product created successfully
 */
router.post('/products', savingsProductController.createProduct);

/**
 * @swagger
 * /api/v1/savings/products/{id}:
 *   patch:
 *     summary: Update an existing savings product (Admin/Staff)
 *     tags: [Savings]
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
 *         description: Savings product updated successfully
 */
router.patch('/products/:id', savingsProductController.updateProduct);
router.delete('/products/:id', savingsProductController.deleteProduct);

module.exports = router;
