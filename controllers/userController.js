const { User, Account } = require('../models');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');
const filterObj = require('../utils/filterObj');
const { generateAccountNumber } = require('../utils/accountHelper');
const { attachInstitution } = require('../middleware/tenantMiddleware');
const { logAction } = require('../utils/auditLogger');

/**
 * @swagger
 * /api/v1/users/update-profile:
 *   patch:
 *     summary: Update current user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               address:
 *                 type: string
 *               state:
 *                 type: string
 *               lga:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               nextOfKinName:
 *                 type: string
 *               nextOfKinPhone:
 *                 type: string
 *               nextOfKinRelationship:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
exports.updateProfile = catchAsync(async (req, res, next) => {
    // 0) Ensure only users in onboarding can use this specific route
    // 2) Filtered out unwanted fields names that are not allowed to be updated
    if (req.body.password || req.body.passwordConfirm) {
        return next(new AppError('This route is not for password updates. Please use /updateMyPassword.', 400));
    }

    // 2) Filtered out unwanted fields names that are not allowed to be updated
    // NOTE: profilePicture and addressProof are NOT here — they are file uploads only,
    // handled by req.files. Including them in filterObj causes the file array to bleed through as a non-string.
    const filteredBody = filterObj(req.body,
        'name', 'email', 'phoneNumber', 'address', 'state', 'lga',
        'dateOfBirth', 'nextOfKinName', 'nextOfKinPhone', 'nextOfKinRelationship', 'nextOfKinAddress',
        'idType', 'idNumber', 'occupation', 'employer',
        'bankName', 'accountNumber', 'maritalStatus', 'membershipType'
    );

    try {
        // Verify user exists
        const existingUser = await User.findByPk(req.user.id);
        if (!existingUser) {
            return next(new AppError('User not found', 404));
        }

        // STRIP ALL EMPTY / UNDEFINED values — MySQL cannot bind empty strings to DATE columns
        Object.keys(filteredBody).forEach(key => {
            if (filteredBody[key] === '' || filteredBody[key] === undefined || filteredBody[key] === null) {
                delete filteredBody[key];
            }
        });

        // Add file paths only if files were uploaded — always strings (filename only)
        if (req.files?.profilePicture) filteredBody.profilePicture = req.files.profilePicture[0].filename;
        if (req.files?.addressProof) filteredBody.addressProof = req.files.addressProof[0].filename;
        if (req.file) filteredBody.profilePicture = req.file.filename; // single-upload fallback

        // Use User.update() — only sends the exact fields we specify, avoiding
        // dirty-field tracking bugs that cause "Incorrect arguments to mysqld_stmt_execute"
        if (Object.keys(filteredBody).length > 0) {
            await User.update(filteredBody, {
                where: { id: req.user.id },
                hooks: false,     // skip beforeSave hook (no password change here)
                validate: false   // skip field-type validation (all values are already sanitized)
            });
        }

        // Fetch updated user to return in response
        const updatedUser = await User.findByPk(req.user.id);

        res.status(200).json({
            status: 'success',
            data: {
                user: updatedUser
            }
        });
    } catch (err) {
        console.error('CRITICAL ERROR IN updateProfile:', err.name, err.message);
        return next(err);
    }
});

/**
 * @swagger
 * /api/v1/users/submit-onboarding:
 *   patch:
 *     summary: Submit detailed membership info and request approval
 *     tags: [Users]
 */
exports.submitOnboarding = catchAsync(async (req, res, next) => {
    // 1) Filtered out unwanted fields
    const filteredBody = filterObj(req.body,
        'phoneNumber', 'address', 'state', 'lga',
        'dateOfBirth', 'nextOfKinName', 'nextOfKinPhone', 'nextOfKinRelationship', 'nextOfKinAddress',
        'idType', 'idNumber', 'idImage', 'profilePicture',
        'occupation', 'employer', 'gender',
        'bankName', 'bankCode', 'accountNumber'
    );

    // 2) Update user document and change status
    const updatedUser = await User.findByPk(req.user.id);

    if (!updatedUser) {
        return next(new AppError('User not found', 404));
    }

    // Explicitly update fields from filteredBody
    Object.keys(filteredBody).forEach(key => {
        updatedUser[key] = filteredBody[key];
    });

    // Handle Mappings
    updatedUser.phoneNumber = req.body.phone || req.body.phoneNumber;
    updatedUser.dateOfBirth = req.body.dob || req.body.dateOfBirth;
    updatedUser.nextOfKinName = req.body.nokName || req.body.nextOfKinName;
    updatedUser.nextOfKinPhone = req.body.nokPhone || req.body.nextOfKinPhone;
    updatedUser.nextOfKinRelationship = req.body.nokRelationship || req.body.nextOfKinRelationship;
    updatedUser.idNumber = req.body.idNumber;
    updatedUser.bankName = req.body.bankName;
    updatedUser.bankCode = req.body.bankCode;
    updatedUser.accountNumber = req.body.accountNumber;

    if (req.files?.idImage) updatedUser.idImage = req.files.idImage[0].filename;
    if (req.files?.profilePicture) updatedUser.profilePicture = req.files.profilePicture[0].filename;

    updatedUser.status = 'pending_approval';

    await updatedUser.save({ validate: false });

    // ─── ADMIN NOTIFICATION ───
    try {
        const { Op } = require('sequelize');
        const socketIO = require('../utils/socket');
        const { sendNotification } = require('../utils/notificationService');

        // Find admins for this institution
        const admins = await User.findAll({
            where: {
                institutionId: updatedUser.institutionId,
                role: { [Op.in]: ['institution_admin', 'staff'] },
                status: 'active'
            }
        });

        for (const admin of admins) {
            await sendNotification({
                userId: admin.id,
                title: 'Membership Review Required 📄',
                message: `${updatedUser.name} has submitted their onboarding details and is awaiting your approval.`,
                type: 'info',
                link: `/admin/users?status=pending_approval`
            });
        }

        // Real-time broadcast for dashboard sync
        socketIO.emitToAdmins('request_sync', {
            type: 'onboarding_submission',
            name: updatedUser.name
        });
    } catch (err) {
        console.error('Failed to notify admins of onboarding submission:', err);
    }

    try {
        const { Institution } = require('../models');
        const institution = await Institution.findByPk(updatedUser.institutionId);
        await new Email(updatedUser, '', institution).sendOnboardingComplete();
    } catch (err) {
        console.error('Email failed to send:', err);
    }

    res.status(200).json({
        status: 'success',
        message: 'Onboarding submitted successfully. Your account is now pending approval.',
        data: {
            user: updatedUser
        }
    });
});

/**
 * @swagger
 * /api/v1/users/admin/users:
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 */
exports.getAllUsers = catchAsync(async (req, res, next) => {
    const { Op } = require('sequelize');
    const where = attachInstitution(req);

    const statusParams = req.query.status || req.query['status[]'];
    if (statusParams) {
        if (Array.isArray(statusParams)) {
            where.status = { [Op.in]: statusParams };
        } else {
            where.status = statusParams;
        }
    }

    const roleParams = req.query.role || req.query['role[]'];
    if (roleParams) {
        if (Array.isArray(roleParams)) {
            where.role = { [Op.in]: roleParams };
        } else {
            where.role = roleParams;
        }
    }

    const users = await User.findAll({
        where,
        attributes: { exclude: ['password'] }
    });

    res.status(200).json({
        status: 'success',
        results: users.length,
        data: {
            users
        }
    });
});


const PaystackService = require('../services/paystackService');

/**
 * @swagger
 * /api/v1/users/{id}/approve:
 *   patch:
 *     summary: Approve a user to become a member
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: User ID
 *     responses:
 *       200:
 *         description: User approved and accounts created
 */
exports.approveMember = catchAsync(async (req, res, next) => {
    const user = await User.findByPk(req.params.id);

    if (!user) {
        return next(new AppError('No user found with that ID', 404));
    }

    if (user.role === 'member' || user.role === 'staff' || user.role === 'super_admin') {
        if (user.status === 'active') {
            return next(new AppError('User is already an active member or admin', 400));
        }
    }

    // Allow approval for pending_approval OR rejected users
    if (user.status !== 'pending_approval' && user.status !== 'rejected') {
        return next(new AppError('Only users pending approval or previously rejected can be approved', 400));
    }

    // 1. Update Role to 'member' and Status to 'active'
    user.role = 'member';
    user.status = 'active';
    user.rejectionReason = null; // Clear rejection reason if any

    // 2. Create Paystack Customer
    try {
        const customerData = await PaystackService.createCustomer(user);
        user.paystackCustomerCode = customerData.customer_code;
    } catch (err) {
        console.error('Failed to create Paystack customer:', err.message);
        // We continue anyway, as the member role is more important than the DVA for now
    }

    await user.save();

    logAction(req, 'MEMBER_APPROVED', { userId: user.id, name: user.name });

    // ─── NOTIFICATION & EMAIL ───
    try {
        const { Institution } = require('../models');
        const Email = require('../utils/email');
        const institution = await Institution.findByPk(user.institutionId);

        // Send tailored approval email
        await new Email(user, process.env.FRONTEND_URL, institution).sendMembershipApproval();

        // Send in-app notification
        const { sendNotification } = require('../utils/notificationService');
        await sendNotification({
            userId: user.id,
            title: 'Membership Approved! 🎉',
            message: `Welcome to ${institution?.name || 'the cooperative'}! Your membership application has been approved.`,
            type: 'success',
            link: '/dashboard'
        });
    } catch (err) {
        console.error('Failed to send approval notifications:', err);
    }

    // 3. Auto-Create Accounts (Savings & Share Capital)
    const accountTypes = ['savings', 'share_capital'];
    const createdAccounts = [];

    for (const type of accountTypes) {
        // Check if account exists (idempotency)
        let account = await Account.findOne({
            where: { userId: user.id, accountType: type }
        });

        if (!account) {
            const accountNumber = await generateAccountNumber();
            account = await Account.create({
                userId: user.id,
                institutionId: user.institutionId,
                accountNumber,
                accountType: type,
                balance: 0.00,
                status: 'active',
                openedAt: new Date()
            });
            createdAccounts.push(account);

            // 4. Assign Paystack Dedicated Virtual Account (only for savings)
            if (type === 'savings' && user.paystackCustomerCode) {
                try {
                    const dvaData = await PaystackService.assignDedicatedAccount(user.paystackCustomerCode);
                    account.paystackDedicatedAccountNumber = dvaData.account_number;
                    account.paystackDedicatedAccountBank = dvaData.bank.name;
                    account.paystackDedicatedAccountName = dvaData.account_name;
                    await account.save();
                } catch (err) {
                    console.error('Failed to assign Paystack DVA:', err.message);
                }
            }
        }
    }

    res.status(200).json({
        status: 'success',
        message: 'User approved and upgraded to member. Accounts created.',
        data: {
            user,
            createdAccounts
        }
    });
});

/**
 * @swagger
 * /api/v1/users/{id}/reject:
 *   patch:
 *     summary: Reject a user's membership application
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: User application rejected
 *       400:
 *         description: Missing reason or user cannot be rejected
 */
exports.rejectMember = catchAsync(async (req, res, next) => {
    const { reason } = req.body;

    if (!reason || reason.trim() === '') {
        return next(new AppError('A rejection reason is required', 400));
    }

    const user = await User.findByPk(req.params.id);

    if (!user) {
        return next(new AppError('No user found with that ID', 404));
    }

    if (user.status !== 'pending_approval') {
        return next(new AppError('Only users pending approval can be rejected', 400));
    }

    // 1. Update Status to 'rejected' and store reason
    user.status = 'rejected';
    user.rejectionReason = reason;

    await user.save({ validate: false });

    logAction(req, 'MEMBER_REJECTED', { userId: user.id, reason });

    // 2. Send Email & In-App Notification
    try {
        const { Institution } = require('../models');
        const Email = require('../utils/email');
        const { sendNotification } = require('../utils/notificationService');

        const institution = await Institution.findByPk(user.institutionId);

        // Send tailored rejection email
        await new Email(user, process.env.FRONTEND_URL, institution).sendApplicationRejected(reason);

        // Send in-app notification
        await sendNotification({
            userId: user.id,
            title: 'Application Update 📄',
            message: `Your membership application for ${institution?.name || 'the cooperative'} was not approved. Click to see the reason.`,
            type: 'warning',
            link: '/onboarding' // Redirect back to onboarding so they can fix issues
        });
    } catch (err) {
        console.error('Failed to send rejection notifications:', err);
    }

    res.status(200).json({
        status: 'success',
        message: 'User application rejected and applicant notified.',
        data: {
            user
        }
    });
});

/**
 * @swagger
 * /api/v1/users/{id}/admin-update:
 *   patch:
 *     summary: Update user role or status (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: User ID
 *     responses:
 *       200:
 *         description: User updated successfully
 */
exports.adminUpdateUser = catchAsync(async (req, res, next) => {
    const {
        role,
        status,
        name,
        phoneNumber,
        bankName,
        accountNumber,
        address,
        lga,
        state,
        occupation,
        employer,
        maritalStatus,
        gender,
        membershipType,
        bankCode,
        nextOfKinAddress
    } = req.body;

    const user = await User.findByPk(req.params.id);

    if (!user) {
        return next(new AppError('No user found with that ID', 404));
    }

    // Role validation
    if (role) {
        const allowedRoles = ['super_admin', 'staff', 'member', 'user'];
        if (!allowedRoles.includes(role)) return next(new AppError('Invalid role', 400));
        user.role = role;
    }

    // Status validation
    if (status) {
        const allowedStatuses = ['active', 'inactive', 'suspended', 'pending_onboarding', 'pending_approval'];
        if (!allowedStatuses.includes(status)) return next(new AppError('Invalid status', 400));
        user.status = status;
    }

    // Basic Fields update
    if (name) user.name = name;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (bankName) user.bankName = bankName;
    if (accountNumber) user.accountNumber = accountNumber;
    if (address) user.address = address;
    if (lga) user.lga = lga;
    if (state) user.state = state;
    if (occupation) user.occupation = occupation;
    if (employer) user.employer = employer;
    if (maritalStatus) user.maritalStatus = maritalStatus;
    if (gender) user.gender = gender;
    if (membershipType) user.membershipType = membershipType;
    if (bankCode) user.bankCode = bankCode;
    if (req.body.nextOfKinAddress) user.nextOfKinAddress = req.body.nextOfKinAddress;

    await user.save({ validate: false });

    logAction(req, 'USER_ADMIN_UPDATE', {
        targetUserId: user.id,
        updates: { role, status, name }
    });

    res.status(200).json({
        status: 'success',
        message: 'User updated successfully',
        data: {
            user
        }
    });
});

/**
 * @swagger
 * /api/v1/users/admin-create:
 *   post:
 *     summary: Create user directly with role (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
exports.adminCreateUser = catchAsync(async (req, res, next) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
        return next(new AppError('Please provide name, email, password and role', 400));
    }

    const allowedRoles = ['super_admin', 'staff', 'member', 'user'];
    if (!allowedRoles.includes(role)) return next(new AppError('Invalid role', 400));

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
        return next(new AppError('A user with that email already exists', 400));
    }

    const newUser = await User.create({
        name,
        email,
        password,
        role,
        institutionId: req.user.institutionId,
        isEmailVerified: true,
        status: 'active'
    });

    // Remove password from output
    newUser.password = undefined;

    logAction(req, 'USER_ADMIN_CREATE', {
        targetUserId: newUser.id,
        role: newUser.role,
        email: newUser.email
    });

    // Automatically generate Main and Savings accounts for all users created by admins
    // This ensures staff and admins can also save and participate in cooperative activities
    await Account.bulkCreate([
        {
            userId: newUser.id,
            institutionId: newUser.institutionId,
            type: 'main',
            accountNumber: `MA${newUser.id.toString().padStart(8, '0')}`,
            balance: 0.00,
            status: 'active',
            openedAt: new Date()
        },
        {
            userId: newUser.id,
            institutionId: newUser.institutionId,
            type: 'savings',
            accountNumber: `SA${newUser.id.toString().padStart(8, '0')}`,
            balance: 0.00,
            status: 'active',
            openedAt: new Date()
        }
    ]);
    res.status(201).json({
        status: 'success',
        message: 'User created successfully',
        data: {
            user: newUser
        }
    });
});
exports.getUser = catchAsync(async (req, res, next) => {
    const user = await User.findByPk(req.params.id);

    if (!user) {
        return next(new AppError('No user found with that ID', 404));
    }

    res.status(200).json({
        status: 'success',
        data: {
            user
        }
    });
});
/**
 * Search active members by name or email
 * GET /api/v1/users/search?q=query
 */
exports.searchMembers = catchAsync(async (req, res, next) => {
    const { q } = req.query;
    const { Op } = require('sequelize');

    if (!q || q.length < 2) {
        return res.status(200).json({
            status: 'success',
            data: { users: [] }
        });
    }

    const users = await User.findAll({
        where: {
            ...attachInstitution(req),
            status: 'active',
            [Op.or]: [
                { name: { [Op.like]: `%${q}%` } },
                { email: { [Op.like]: `%${q}%` } }
            ]
        },
        attributes: ['id', 'name', 'email'],
        include: [
            {
                model: Account,
                as: 'accounts',
                where: { accountType: 'savings' },
                attributes: ['balance'],
                required: false
            }
        ],
        limit: 10
    });

    res.status(200).json({
        status: 'success',
        data: { users }
    });
});
