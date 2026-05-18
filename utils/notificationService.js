const { Notification } = require('../models');
const socketIO = require('./socket');

/**
 * Centralized utility to send in-app notifications
 */
const sendNotification = async ({ userId, title, message, type = 'info', link = null }) => {
    try {
        const notification = await Notification.create({
            userId,
            title,
            message,
            type,
            link
        });

        // Trigger real-time UI refresh for the recipient
        socketIO.emitToUser(userId, 'new_notification', notification);

        return notification;
    } catch (error) {
        console.error('FAILED TO SEND NOTIFICATION:', error);
        // We don't throw here to avoid breaking the calling transaction/process
        return null;
    }
};

module.exports = {
    sendNotification
};
