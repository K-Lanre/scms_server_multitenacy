const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const { User } = require('../models');

exports.protect = async (req, res, next) => {
    try {
        // 1) Getting token and check of it's there
        let token;
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith('Bearer')
        ) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                status: 'fail',
                message: 'You are not logged in! Please log in to get access.'
            });
        }

        // 2) Verification token
        const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

        // 3) Check if user still exists
        const currentUser = await User.findByPk(decoded.id);
        if (!currentUser) {
            return res.status(401).json({
                status: 'fail',
                message: 'The user belonging to this token does no longer exist.'
            });
        }

        // GRANT ACCESS TO PROTECTED ROUTE
        req.user = currentUser;
        
        // Auto-apply tenant scoping to all protected routes
        const { scopeToInstitution } = require('./tenantMiddleware');
        return scopeToInstitution(req, res, next);
    } catch (err) {
        res.status(401).json({
            status: 'fail',
            message: 'Invalid token or authorization error.'
        });
    }
};

exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        // roles is an array ['admin', 'staff']
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                status: 'fail',
                message: 'You do not have permission to perform this action'
            });
        }
        next();
    };
};
