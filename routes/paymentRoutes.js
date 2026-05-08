const express = require('express');
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

// POST /api/v1/payments/initialize - Start a new Paystack payment
router.post('/initialize', paymentController.initializePayment);

// GET /api/v1/payments/verify/:reference - Verify and complete a payment
router.get('/verify/:reference', paymentController.verifyPayment);

module.exports = router;
