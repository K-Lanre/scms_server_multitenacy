const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Dynamic dashboard statistics and charts
 */

router.use(protect);

/**
 * @swagger
 * /api/v1/dashboard/stats:
 *   get:
 *     summary: Get dashboard statistics (role-based)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 */
router.get('/stats', dashboardController.getDashboardStats);

/**
 * @swagger
 * /api/v1/dashboard/charts:
 *   get:
 *     summary: Get dashboard chart data (role-based)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard chart data retrieved successfully
 */
router.get('/charts', dashboardController.getChartData);

module.exports = router;
