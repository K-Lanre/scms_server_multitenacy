if (!process.env.NODE_ENV && (process.env.DATABASE_URL || process.env.RENDER)) {
    process.env.NODE_ENV = 'production';
}

const http = require('http');
const app = require('./app');
const socketIO = require('./utils/socket');
const fs = require('fs');
const path = require('path');
const logger = require('./config/logger');
const { validateSourceFiles } = require('./utils/fileIntegrity');
const { monitorFileSizes } = require('./utils/fileMonitor');

console.log(app.get('env'));

// File size validation to prevent corruption
const validateServerFile = () => {
    const serverPath = __filename;
    const stats = fs.statSync(serverPath);
    if (stats.size > 1000000) { // 1 MB threshold
        logger.error('CRITICAL: server.js file is too large!');
        logger.error(`Size: ${stats.size} bytes`);
        logger.error('Possible file corruption detected. Please restore from backup.');
        process.exit(1);
    }
};
validateServerFile();

// Validate all source files on startup
validateSourceFiles();

// Start file size monitoring
monitorFileSizes();

const { connectDB } = require('./config/database');
const { startScheduler } = require('./jobs/scheduler');

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('uncaughtException', err => {
    logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...', { error: err.message, stack: err.stack });
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', err => {
    logger.error('UNHANDLED REJECTION! 💥 Shutting down...', { error: err.message, stack: err.stack });
    gracefulShutdown('unhandledRejection');
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Connect to Database
connectDB().then(async () => {
    console.log('Database connected successfully (server.js)');

    // Sync without alter to prevent index accumulation.
    // Use migrations for schema changes instead.
    try {
        const db = require('./models');
        await db.sequelize.sync({ alter: false });
        console.log('Database synchronized (alter: false)');
    } catch (err) {
        console.error('Database sync failed:', err);
    }

    // Start cron jobs after DB connection
    startScheduler();
});

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Initialize Socket.io
socketIO.init(server);

server.listen(PORT, () => {
    logger.info(`App running on port ${PORT}... (WebSockets enabled)`);
});
