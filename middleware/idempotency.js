const Redis = require('redis');

// Initialize Redis Client for Idempotency
let redisClient = null;
let useRedis = false;

// Fallback in-memory map if Redis is not configured
const memoryCache = new Map();

if (process.env.REDIS_URL || process.env.REDIS_HOST) {
    const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`;
    redisClient = Redis.createClient({ url: redisUrl });
    
    redisClient.on('error', (err) => console.log('Redis Client Error for Idempotency', err));
    redisClient.connect().then(() => {
        useRedis = true;
        console.log('Redis connected for Idempotency keys');
    }).catch(console.error);
}

/**
 * Middleware to ensure request idempotency.
 * Expects an 'Idempotency-Key' header from the client.
 */
const checkIdempotency = async (req, res, next) => {
    if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
        return next();
    }

    const idempotencyKey = req.header('Idempotency-Key');
    if (!idempotencyKey) {
        return next(); // Proceed normally if no key is provided
    }

    const cacheKey = `idempotency:${req.user?.id || 'anon'}:${idempotencyKey}`;

    try {
        let cachedResponse = null;

        if (useRedis && redisClient) {
            const data = await redisClient.get(cacheKey);
            if (data) cachedResponse = JSON.parse(data);
        } else {
            cachedResponse = memoryCache.get(cacheKey);
        }

        if (cachedResponse) {
            console.log(`Idempotency hit for key: ${idempotencyKey}`);
            // Send the identical cached response
            return res.status(cachedResponse.statusCode).json(cachedResponse.body);
        }

        // Intercept res.json to cache the successful response
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            // Only cache successful status codes (e.g. 200, 201)
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const responseToCache = {
                    statusCode: res.statusCode,
                    body: body
                };

                if (useRedis && redisClient) {
                    redisClient.setEx(cacheKey, 86400, JSON.stringify(responseToCache)); // Expire in 24 hours
                } else {
                    memoryCache.set(cacheKey, responseToCache);
                    // Manually delete after 24 hours
                    setTimeout(() => memoryCache.delete(cacheKey), 86400 * 1000);
                }
            }
            return originalJson(body);
        };

        next();
    } catch (err) {
        console.error('Idempotency middleware error:', err);
        next();
    }
};

module.exports = { checkIdempotency };
