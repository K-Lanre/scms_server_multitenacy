const { AuditLog } = require('../models');

/**
 * Log an administrative or critical action
 * @param {Object} req - Express request object (to get user, IP, agent)
 * @param {string} action - Action name (e.g., 'LOAN_APPROVED')
 * @param {Object|string} details - Additional details for the log
 * @param {number} forcedUserId - Optional explicit user ID (e.g., for login/signup)
 */
exports.logAction = async (req, action, details = null, forcedUserId = null) => {
    try {
        const userId = forcedUserId || (req.user ? req.user.id : null);
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        // Convert details to string if it's an object
        const finalDetails = typeof details === 'object' ? JSON.stringify(details) : details;

        await AuditLog.create({
            userId,
            action: action.toUpperCase(),
            details: finalDetails,
            ipAddress,
            userAgent
        });
        
        console.log(`[AuditLog] ${action.toUpperCase()} by User ID: ${userId || 'System'}`);
    } catch (err) {
        // We don't want to crash the main app if logging fails
        console.error('[AuditLog Error]', err.message);
    }
};
