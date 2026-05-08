const express = require('express');
const userController = require('../controllers/userController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const uploadMiddleware = require('../middleware/uploadMiddleware');

const router = express.Router();

// protect all routes after this middleware
router.use(protect);

// Allow any logged in user to search active members (e.g. for guarantor selection)
router.get('/search', userController.searchMembers);

// Allow users to update their own profile
router.patch('/update-profile', uploadMiddleware.uploadProfileAndDocs, userController.updateProfile);

// Allow Admin to approve users
router.patch('/:id/approve', restrictTo('super_admin', 'institution_admin'), userController.approveMember);

// Allow Admin to reject users
router.patch('/:id/reject', restrictTo('super_admin', 'institution_admin'), userController.rejectMember);

// Allow Admin to update user role/status
router.patch('/:id/admin-update', restrictTo('super_admin', 'institution_admin'), userController.adminUpdateUser);
router.get('/:id', restrictTo('super_admin', 'institution_admin', 'staff'), userController.getUser);
router.post('/admin-create', restrictTo('super_admin'), userController.adminCreateUser);

router.get('/', restrictTo('super_admin', 'institution_admin', 'staff'), userController.getAllUsers);

module.exports = router;
