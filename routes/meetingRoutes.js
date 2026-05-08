const express = require('express');
const router = express.Router();
const meetingsController = require('../controllers/meetingsController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

// Common routes
router.get('/', meetingsController.getAllMeetings);
router.get('/:id', meetingsController.getMeetingDetails);

// Admin routes
router.use(restrictTo('super_admin', 'institution_admin', 'staff'));
router.post('/schedule', meetingsController.scheduleMeeting);
router.post('/record-minutes/:meetingId', meetingsController.recordMinutes);
router.patch('/cancel/:id', meetingsController.cancelMeeting);

module.exports = router;
