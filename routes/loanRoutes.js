const express = require('express');
const loanController = require('../controllers/loanController');
const repaymentController = require('../controllers/repaymentController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Loans
 *   description: Loan management and workflows
 */

router.post('/apply', restrictTo('member', 'institution_admin', 'staff'), loanController.applyForLoan);
router.get('/my-loans', loanController.getMyLoans);



router.get('/stats/portfolio', restrictTo('staff', 'institution_admin', 'super_admin'), loanController.getPortfolioStats);
router.get('/', loanController.getAllLoans);
router.get('/:id', loanController.getLoanDetails);


router.patch('/:id/cancel', restrictTo('member', 'institution_admin', 'staff'), loanController.cancelLoan);
router.patch('/:id/approve', restrictTo('institution_admin', 'super_admin'), loanController.approveLoan);
router.patch('/:id/reject', restrictTo('institution_admin', 'super_admin'), loanController.rejectLoan);

router.patch('/:id/review', restrictTo('staff', 'super_admin'), loanController.reviewLoan);
router.patch('/:id/disburse', restrictTo('institution_admin', 'super_admin'), loanController.disburseLoan);

// Repayment routes
router.get('/repayments/my-history', repaymentController.getMyTotalRepaymentHistory);
router.post('/:id/repay', repaymentController.makeManualRepayment);
router.get('/:id/repayments', repaymentController.getRepaymentHistory);

module.exports = router;
