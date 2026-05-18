const fs = require('fs');
const path = require('path');

/**
 * Validate critical source files to prevent corruption
 */
const validateSourceFiles = () => {
    const criticalFiles = [
        'server.js',
        'app.js'
    ];

    criticalFiles.forEach(file => {
        const filePath = path.join(__dirname, '..', file);
        try {
            const stats = fs.statSync(filePath);
            const maxSize = 100000; // 100 KB threshold for source files

            if (stats.size > maxSize) {
                throw new Error(
                    `${file} is unusually large: ${stats.size} bytes (max: ${maxSize}). ` +
                    'Possible file corruption detected. Please restore from backup.'
                );
            }
        } catch (err) {
            if (err.code === 'ENOENT') {
                throw new Error(`Critical file not found: ${file}`);
            }
            throw err;
        }
    });

    console.log('✅ File integrity check passed');
};

/**
 * Check if a file is corrupted (contains too many null bytes)
 */
const checkForNullBytes = (filePath, threshold = 0.5) => {
    try {
        const buffer = fs.readFileSync(filePath);
        let nullByteCount = 0;

        for (let i = 0; i < buffer.length; i++) {
            if (buffer[i] === 0) {
                nullByteCount++;
            }
        }

        const nullByteRatio = nullByteCount / buffer.length;
        if (nullByteRatio > threshold) {
            throw new Error(
                `${filePath} contains ${Math.round(nullByteRatio * 100)}% null bytes. ` +
                'File may be corrupted.'
            );
        }
    } catch (err) {
        if (err.message.includes('null bytes')) {
            throw err;
        }
        // Ignore other errors (file might not exist yet)
    }
};

module.exports = {
    validateSourceFiles,
    checkForNullBytes
};
