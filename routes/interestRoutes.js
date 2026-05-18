const express = require('express');
const interestController = require('../controllers/interestController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

// All interest/dividend routes require authentication and are restricted to staff/admins
router.use(protect);
router.use(restrictTo('institution_admin', 'super_admin'));

router.get('/stats', interestController.getPostingStats);
router.post('/process', interestController.processPosting);
router.get('/history', interestController.getPostingHistory);

module.exports = router;
