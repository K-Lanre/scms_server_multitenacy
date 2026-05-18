const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

/**
 * Monitor critical file sizes to detect corruption
 */
const monitorFileSizes = () => {
    const criticalFiles = [
        { path: path.join(__dirname, '..', 'server.js'), maxSize: 100000 },
        { path: path.join(__dirname, '..', 'app.js'), maxSize: 100000 }
    ];

    const checkFile = (fileConfig) => {
        try {
            const filePath = path.resolve(__dirname, fileConfig.path);
            const stats = fs.statSync(filePath);

            if (stats.size > fileConfig.maxSize) {
                logger.error(
                    `ALERT: ${fileConfig.path} is ${stats.size} bytes (max: ${fileConfig.maxSize})`,
                    { size: stats.size, maxSize: fileConfig.maxSize }
                );
            }
        } catch (err) {
            logger.error(`Error checking ${fileConfig.path}: ${err.message}`);
        }
    };

    // Check files every hour
    setInterval(() => {
        logger.info('Running file size monitoring...');
        criticalFiles.forEach(checkFile);
    }, 3600000); // 1 hour

    // Initial check
    logger.info('Initial file size check...');
    criticalFiles.forEach(checkFile);
};

module.exports = {
    monitorFileSizes
};
