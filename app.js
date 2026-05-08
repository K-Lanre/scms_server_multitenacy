const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const accountRoutes = require('./routes/accountRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const loanRoutes = require('./routes/loanRoutes');
const userRoutes = require('./routes/userRoutes');
const savingsRoutes = require('./routes/savingsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const interestRoutes = require('./routes/interestRoutes');
const reportRoutes = require('./routes/reportRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const contributionRoutes = require('./routes/contributionRoutes');
const meetingRoutes = require('./routes/meetingRoutes');
const adminSettingsRoutes = require('./routes/adminSettingsRoutes');
const institutionRoutes = require('./routes/institutionRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const treasuryRoutes = require('./routes/treasuryRoutes');
const searchRoutes = require('./routes/searchRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const { apiLimiter } = require('./middleware/rateLimiter');
app.use('/api/', apiLimiter);

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const paystackWebhookController = require('./controllers/paystackWebhookController'); // Added this line
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');

// Routes
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/accounts', accountRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/loans', loanRoutes);
app.use('/api/v1/savings', savingsRoutes);
app.use('/api/v1/admin/settings', adminSettingsRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/withdrawals', withdrawalRoutes);
app.use('/api/v1/interest', interestRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/contributions', contributionRoutes);
app.use('/api/v1/meetings', meetingRoutes);
app.use('/api/v1/institutions', institutionRoutes);
app.use('/api/v1/super-admin', superAdminRoutes);
app.use('/api/v1/treasury', treasuryRoutes);
app.use('/api/v1/search', searchRoutes);

// Webhooks
app.post('/api/v1/webhooks/paystack', paystackWebhookController.handlePaystackWebhook); // Added this line

// Handle Unhandled Routes
app.use((req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler
app.use(globalErrorHandler);

module.exports = app;
