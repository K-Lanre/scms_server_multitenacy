const express = require('express');
const router = express.Router();
const contributionController = require('../controllers/contributionController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

// Member routes
router.get('/my-contributions', contributionController.getMyContributions);

// Admin routes
router.get('/admin/stats', restrictTo('super_admin', 'institution_admin', 'staff'), contributionController.getContributionStats);
router.get('/admin/report/:month', restrictTo('super_admin', 'institution_admin', 'staff'), contributionController.getMonthlyReport);
router.post('/admin/generate', restrictTo('super_admin', 'institution_admin'), contributionController.generateMonthlyRecords);
router.post('/admin/collect-internal/:id', restrictTo('super_admin', 'institution_admin', 'staff'), contributionController.collectInternalBalance);
router.post('/admin/record-cash/:id', restrictTo('super_admin', 'institution_admin', 'staff'), contributionController.recordCashPayment);

module.exports = router;
