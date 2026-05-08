const express = require('express');
const adminController = require('../controllers/adminController');
const jobController = require('../controllers/jobController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes protected and restricted to admin/super_admin
router.use(protect);
router.use(restrictTo('institution_admin', 'super_admin'));

/**
 * @swagger
 * /api/v1/admin/jobs/{jobType}/run:
 *   post:
 *     summary: Manually trigger a background job
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [loan-deductions, interest-posting, savings-maturity, defaults]
 *         description: The type of job to run
 *     responses:
 *       200:
 *         description: Job executed successfully
 *       400:
 *         description: Invalid job type
 */
router.get('/jobs', jobController.getJobConfigs);
router.post('/jobs', jobController.createJobConfig);
router.patch('/jobs/:id', jobController.updateJobConfig);
router.post('/jobs/:jobType/run', jobController.runJob);

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin dashboard and financial metrics
 */

router.get('/financial-summary', adminController.getFinancialSummary);
router.get('/loan-metrics', adminController.getLoanMetrics);
router.get('/savings-metrics', adminController.getSavingsMetrics);
router.get('/treasury-balance', adminController.getTreasuryBalance);

module.exports = router;
