const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const Redis = require('redis');

// Initialize Redis Client
let redisClient = null;
let useRedis = false;

if (process.env.REDIS_URL || process.env.REDIS_HOST) {
    const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`;
    redisClient = Redis.createClient({ url: redisUrl });

    redisClient.on('error', (err) => console.log('Redis Client Error for RateLimiter', err));
    redisClient.connect().then(() => {
        useRedis = true;
        console.log('Redis connected for Rate Limiting');
    }).catch(console.error);
}

// Generate the store conditionally
const getStore = () => {
    if (useRedis && redisClient) {
        return new RedisStore({
            sendCommand: (...args) => redisClient.sendCommand(args),
        });
    }
    // Fall back to memory store if Redis is unconfigured
    return undefined; // express-rate-limit defaults to MemoryStore
};

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    store: getStore(),
    message: { status: 'error', message: 'Too many requests, please try again later.' },
    skip: (req, res) => process.env.NODE_ENV === 'test'
});

const strictLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    store: getStore(),
    message: { status: 'error', message: 'Too many sensitive requests, please try again after 5 minutes.' },
    skip: (req, res) => process.env.NODE_ENV === 'test'
});

// Rate limiter specifically for resend verification - max 3 attempts per 10 minutes
const resendVerificationLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 3, // Limit each IP to 3 resend requests per 10 minutes
    standardHeaders: true,
    legacyHeaders: false,
    store: getStore(),
    message: { status: 'error', message: 'Too many verification resend requests. Please try again after 10 minutes.' },
    skip: (req, res) => process.env.NODE_ENV === 'test'
});

module.exports = {
    apiLimiter,
    strictLimiter,
    resendVerificationLimiter
};
