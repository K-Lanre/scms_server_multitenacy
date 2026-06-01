const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');
const { logAction } = require('../utils/auditLogger');
const { sendNotification } = require('../utils/notificationService');
const socketIO = require('../utils/socket');

const signToken = (id, institutionId) => {
    return jwt.sign({ id, institutionId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    });
};

const createSendToken = (user, statusCode, res) => {
    const token = signToken(user.id, user.institutionId);
    user.password = undefined; // Hide password in response
    const userResponse = user.toJSON();
    userResponse.hasTransactionPin = !!user.transactionPin;
    userResponse.transactionPin = undefined; // Never send actual pin (even hashed)

    res.status(statusCode).json({
        status: 'success',
        token,
        data: {
            user: userResponse
        }
    });
};

exports.signup = catchAsync(async (req, res, next) => {
    const { name, email, password, passwordConfirm, institutionCode } = req.body;
    const { Institution, sequelize } = require('../models');

    if (!name || !email || !password || !passwordConfirm || !institutionCode) {
        return next(new AppError('Please provide name, email, password, passwordConfirm and institutionCode!', 400));
    }

    // Verify Institution exists
    const institution = await Institution.findOne({ where: { code: institutionCode, status: 'active' } });
    if (!institution) {
        return next(new AppError('Invalid or inactive institution code. Please check and try again.', 404));
    }

    if (password !== passwordConfirm) {
        return next(new AppError('Passwords do not match!', 400));
    }

    // Use a transaction to ensure all-or-nothing registration
    const t = await sequelize.transaction();

    try {
        // Check if user already exists
        const existingUser = await User.findOne({ where: { email }, transaction: t });
        if (existingUser) {
            await t.rollback();
            return next(new AppError('A user with this email address already exists.', 400));
        }

        const newUser = await User.create({
            name,
            email,
            password,
            institutionId: institution.id,
            role: 'user',
            isEmailVerified: false
        }, { transaction: t });

        const verificationToken = newUser.createEmailVerificationToken();
        await newUser.save({ validate: false, transaction: t });

        // LOGGING
        await logAction(req, 'SIGNUP', { email: newUser.email }, newUser.id);

        // Notify all active local admins of the new registration
        const { Op } = require('sequelize');
        const admins = await User.findAll({ 
            where: { 
                institutionId: institution.id,
                role: { [Op.in]: ['institution_admin', 'staff'] }, 
                status: 'active' 
            },
            transaction: t
        });

        for (const admin of admins) {
            await sendNotification({
                userId: admin.id,
                title: 'New Member Signup 👤',
                message: `${newUser.name} (${newUser.email}) has just registered and requires approval.`,
                type: 'info',
                link: `/admin/users?status=pending_approval`
            });
        }

        // Real-time dashboard update (broadcast)
        socketIO.emitToAdmins('request_sync', {
            type: 'new_user_registration',
            name: newUser.name,
            email: newUser.email
        });

        // ─── COMMIT TRANSACTION ───
        // Only after all DB operations succeed do we commit
        await t.commit();

        // ─── ASYNC OPERATIONS (Post-Commit) ───
        // Email failure shouldn't rollback the whole signup, so we do it after commit
        try {
            await new Email(newUser, process.env.FRONTEND_URL, institution).sendEmailVerification(verificationToken);
        } catch (err) {
            console.error('Email failed to send:', err);
        }

        createSendToken(newUser, 201, res);
    } catch (err) {
        // ROLLBACK on any error
        if (t) await t.rollback();
        return next(err);
    }
});

exports.login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return next(new AppError('Please provide email and password!', 400));
    }

    const { Institution } = require('../models');
    const user = await User.findOne({ 
        where: { email },
        include: [{ model: Institution, as: 'institution' }]
    });

    if (!user || !(await user.validatePassword(password))) {
        logAction(req, 'LOGIN_FAILURE', { email });
        return next(new AppError('Incorrect email or password', 401));
    }

    if (['inactive', 'suspended'].includes(user.status)) {
        logAction(req, 'LOGIN_BLOCKED', { email, reason: user.status }, user.id);
        return next(new AppError(`Your account is ${user.status}. Please contact your institution administrator.`, 403));
    }

    if (user.role !== 'super_admin' && (!user.institution || user.institution.status !== 'active')) {
        logAction(req, 'LOGIN_BLOCKED', { email, reason: 'institution_inactive' }, user.id);
        return next(new AppError('Your institution is inactive or unavailable. Please contact support.', 403));
    }

    logAction(req, 'LOGIN_SUCCESS', null, user.id);
    createSendToken(user, 200, res);
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
    // 1) Get user based on POSTed email
    const user = await User.findOne({ where: { email: req.body.email } });
    if (!user) {
        return next(new AppError('There is no user with email address.', 404));
    }

    // 2) Generate the random reset token
    const resetToken = user.createPasswordResetToken();
    await user.save(); // Don't use validate: false because we want hooks to run if needed, though here we only changed reset fields

    // 3) Send it to user's email
    try {
        const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        await new Email(user, resetURL).sendPasswordReset();

        res.status(200).json({
            status: 'success',
            message: 'Token sent to email!'
        });
    } catch (err) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        return next(new AppError('There was an error sending the email. Try again later!', 500));
    }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
    // 1) Get user based on the token
    const hashedToken = crypto
        .createHash('sha256')
        .update(req.params.token)
        .digest('hex');

    const { Op } = require('sequelize');
    const user = await User.findOne({
        where: {
            passwordResetToken: hashedToken,
            passwordResetExpires: { [Op.gt]: Date.now() }
        }
    });

    // 2) If token has not expired, and there is user, set the new password
    if (!user) {
        return next(new AppError('Token is invalid or has expired', 400));
    }
    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // 3) Log the user in, send JWT
    createSendToken(user, 200, res);
});

exports.updateMyPassword = catchAsync(async (req, res, next) => {
    // 1) Get user from collection
    const user = await User.findByPk(req.user.id);

    // 2) Check if POSTed current password is correct
    if (!(await user.validatePassword(req.body.passwordCurrent))) {
        return next(new AppError('Your current password is wrong', 401));
    }

    // 3) If so, update password
    user.password = req.body.password;
    await user.save();

    // 4) Log user in, send JWT
    createSendToken(user, 200, res);
});

exports.profile = catchAsync(async (req, res, next) => {
    const userId = req.user.id;

    const { Institution } = require('../models');
    const user = await User.findByPk(userId, {
        include: [{ model: Institution, as: 'institution' }]
    });
    if (!user) {
        return next(new AppError('User not found', 404));
    }

    const userResponse = user.toJSON();
    userResponse.hasTransactionPin = !!user.transactionPin;
    userResponse.transactionPin = undefined;

    res.status(200).json({
        status: 'success',
        data: {
            user: userResponse
        }
    });
});

exports.verifyEmail = catchAsync(async (req, res, next) => {
    const { token } = req.body;

    if (!token) {
        return next(new AppError('Please provide a verification token!', 400));
    }

    const crypto = require('crypto');
    const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    const { Op } = require('sequelize');
    const user = await User.findOne({
        where: {
            emailVerificationToken: hashedToken,
            emailVerificationExpires: { [Op.gt]: Date.now() },
            id: req.user.id
        }
    });

    if (!user) {
        return next(new AppError('Token is invalid or has expired', 400));
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save({ validate: false });

    // Send the welcome email since they verified
    const onboardingUrl = `${process.env.FRONTEND_URL}/onboarding`;
    try {
        await new Email(user, onboardingUrl).sendWelcome();
    } catch (err) {
        console.error('Welcome email failed to send:', err);
    }

    res.status(200).json({
        status: 'success',
        message: 'Email has been verified successfully',
        data: { user }
    });
});

exports.resendVerification = catchAsync(async (req, res, next) => {
    const user = await User.findByPk(req.user.id);

    if (!user) return next(new AppError('User not found', 404));
    if (user.isEmailVerified) return next(new AppError('Email is already verified', 400));

    const verificationToken = user.createEmailVerificationToken();
    await user.save({ validate: false });

    try {
        await new Email(user, '').sendEmailVerification(verificationToken);
        res.status(200).json({
            status: 'success',
            message: 'Verification code sent to your email.'
        });
    } catch (err) {
        console.error('Failed to send verification email:', err);
        return next(new AppError('Error sending verification email. Please try again later.', 500));
    }
});
