const { body, param, validationResult } = require('express-validator');

// Generic validation result handler
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            status: 'error',
            message: 'Validation failed',
            errors: errors.array().map(err => ({ field: err.path, message: err.msg }))
        });
    }
    next();
};

const transferValidators = [
    body('fromAccountId').isInt().withMessage('Source account ID must be a valid integer'),
    body('toAccountNumber').isString().isLength({ min: 3, max: 20 }).withMessage('Destination account number must be between 3 and 20 characters'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
    body('description').optional().isString().trim(),
    body('purpose').optional().isIn(['debt_repayment', 'family_support', 'contribution', 'business', 'savings', 'other', 'account_transfer']).withMessage('Invalid purpose selected'),
    validate
];

const withdrawDepositValidators = [
    body('accountId').isInt().withMessage('Account ID must be a valid integer'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
    body('description').optional().isString().trim(),
    validate
];

module.exports = {
    validate,
    transferValidators,
    withdrawDepositValidators
};
