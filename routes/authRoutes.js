const express = require('express');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const uploadMiddleware = require('../middleware/uploadMiddleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication and User management
 */

// Public routes
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword/:token', authController.resetPassword);

// PROTECTED ROUTES (Requires Login)
router.use(authMiddleware.protect);

router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.patch('/updateMyPassword', authController.updateMyPassword);
router.get('/profile', authController.profile);
router.patch('/update-profile', uploadMiddleware.uploadProfileAndDocs, userController.updateProfile);
router.patch('/submit-onboarding', uploadMiddleware.uploadOnboardingImages, userController.submitOnboarding);

// ADMIN ONLY ROUTES (Requires Login + Admin/Staff role)
// Admin user management now handled by userRoutes.js

module.exports = router;
