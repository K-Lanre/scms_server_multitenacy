const express = require('express');
const router = express.Router();
const systemSettingsController = require('../controllers/systemSettingsController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);
router.get('/public', systemSettingsController.getPublicSettings);

router.use(restrictTo('super_admin', 'institution_admin', 'staff'));

router.get('/', systemSettingsController.getAllSettings);
router.patch('/update', systemSettingsController.updateSetting);
router.patch('/bulk-update', systemSettingsController.bulkUpdateSettings);
router.get('/:key', systemSettingsController.getSettingByKey);
router.patch('/:key', systemSettingsController.updateSetting);

module.exports = router;
