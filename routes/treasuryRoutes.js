const express = require('express');
const treasuryController = require('../controllers/treasuryController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { scopeToInstitution } = require('../middleware/tenantMiddleware');

const router = express.Router();

router.use(protect);
router.use(scopeToInstitution);

router.get('/summary', restrictTo('institution_admin', 'super_admin', 'staff'), treasuryController.getTreasurySummary);
router.post('/fund', restrictTo('institution_admin', 'super_admin', 'staff'), treasuryController.initializeTreasuryFunding);

module.exports = router;
