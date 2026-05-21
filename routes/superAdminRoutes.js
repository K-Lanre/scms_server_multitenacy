const express = require('express');
const superAdminController = require('../controllers/superAdminController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication and super_admin role
router.use(protect);
router.use(restrictTo('super_admin'));

router.get('/stats', superAdminController.getSystemStats);
router.get('/reports/summary', superAdminController.getPlatformReportSummary);
router.get('/recent-activity', superAdminController.getRecentActivity);
router.get('/institutions-summary', superAdminController.getInstitutionsSummary);
router.get('/institutions/:id', superAdminController.getInstitutionDetail);
router.get('/users/search', superAdminController.searchAllUsers);
router.get('/users', superAdminController.getPlatformAdmins);
router.post('/users', superAdminController.createPlatformUser);
router.get('/audit-logs', superAdminController.getAuditLogs);

module.exports = router;
