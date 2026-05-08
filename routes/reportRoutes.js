const express = require('express');
const reportController = require('../controllers/reportController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.get('/statement', reportController.getAccountStatement);

router.use(restrictTo('staff', 'institution_admin', 'super_admin'));
router.get('/transactions', reportController.getTransactionExport);
router.get('/audit-logs', reportController.getInstitutionAuditLogs);

module.exports = router;
