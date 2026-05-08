const express = require('express');
const institutionController = require('../controllers/institutionController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { scopeToInstitution } = require('../middleware/tenantMiddleware');
const { uploadInstitutionLogo } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Public routes (Signup search)
router.get('/public', institutionController.getPublicInstitutions);

// All other routes require authentication
router.use(protect);

// Routes for individual institution admins/staff
router.get('/my-institution', scopeToInstitution, institutionController.getMyInstitution);
router.patch('/my-institution', scopeToInstitution, restrictTo('institution_admin', 'super_admin', 'staff'), uploadInstitutionLogo, institutionController.updateInstitution);

// Routes for platform Super Admin
router.post('/', restrictTo('super_admin'), institutionController.createInstitution);
router.get('/', restrictTo('super_admin'), institutionController.getAllInstitutions);
router.patch('/:id', restrictTo('super_admin'), uploadInstitutionLogo, institutionController.updateInstitution);

module.exports = router;
