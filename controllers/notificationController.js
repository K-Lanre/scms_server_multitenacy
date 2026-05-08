const { Notification } = require('../models');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

/**
 * Get all notifications for the current user
 * GET /api/v1/notifications
 */
exports.getMyNotifications = catchAsync(async (req, res, next) => {
    const notifications = await Notification.findAll({
        where: { userId: req.user.id },
        order: [['createdAt', 'DESC']],
        limit: 50
    });

    res.status(200).json({
        status: 'success',
        results: notifications.length,
        data: { notifications }
    });
});

/**
 * Mark a specific notification as read
 * PATCH /api/v1/notifications/:id/read
 */
exports.markAsRead = catchAsync(async (req, res, next) => {
    const notification = await Notification.findOne({
        where: { id: req.params.id, userId: req.user.id }
    });

    if (!notification) {
        return next(new AppError('Notification not found', 404));
    }

    await notification.update({
        isRead: true,
        readAt: new Date()
    });

    res.status(200).json({
        status: 'success',
        data: { notification }
    });
});

/**
 * Mark all notifications as read for current user
 * PATCH /api/v1/notifications/read-all
 */
exports.markAllAsRead = catchAsync(async (req, res, next) => {
    await Notification.update(
        { isRead: true, readAt: new Date() },
        { where: { userId: req.user.id, isRead: false } }
    );

    res.status(200).json({
        status: 'success',
        message: 'All notifications marked as read'
    });
});
