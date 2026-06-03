const { Institution, User, Account, SavingsProduct, SystemSetting, JobConfig, sequelize } = require('../models');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { sendNotification } = require('../utils/notificationService');
const Email = require('../utils/email');
const { getTreasuryAccount } = require('../utils/treasuryManager');

// Generate unique institution code
const generateInstitutionCode = async () => {
    const prefix = 'COOP';
    let code;
    let exists = true;

    while (exists) {
        const randomNum = Math.floor(1000 + Math.random() * 9000); // 4-digit number
        code = `${prefix}${randomNum}`;
        const existing = await Institution.findOne({ where: { code } });
        exists = !!existing;
    }

    return code;
};

const buildDefaultSettings = (institutionId, defaultInterestRate) => [
    {
        key: 'monthlyThriftAmount',
        value: '10000',
        type: 'number',
        description: 'Default monthly thrift contribution',
        institutionId
    },
    {
        key: 'monthly_thrift_amount',
        value: '10000',
        type: 'number',
        description: 'Default monthly thrift contribution',
        institutionId
    },
    {
        key: 'monthly_commission_amount',
        value: '0',
        type: 'number',
        description: 'Default monthly commission amount',
        institutionId
    },
    {
        key: 'lateThriftPenalty',
        value: '500',
        type: 'number',
        description: 'Penalty for late thrift payment',
        institutionId
    },
    {
        key: 'thrift_penalty_amount',
        value: '500',
        type: 'number',
        description: 'Penalty for unpaid monthly thrift',
        institutionId
    },
    {
        key: 'loan_interest_tiers',
        value: JSON.stringify([
            { minMonths: 1, maxMonths: 3, rate: Number(defaultInterestRate) || 5, label: 'Emergency' },
            { minMonths: 4, maxMonths: 12, rate: Math.max((Number(defaultInterestRate) || 5) - 1, 1), label: 'Standard' },
            { minMonths: 13, maxMonths: 60, rate: Math.max((Number(defaultInterestRate) || 5) - 2, 1), label: 'Project' }
        ]),
        type: 'json',
        description: 'Monthly interest rates based on loan duration',
        institutionId
    }
];

const buildDefaultSavingsProducts = (institutionId, defaultInterestRate) => [
    {
        name: 'General Savings',
        description: 'Default savings product for cooperative members',
        type: 'safebox',
        category: 'none',
        interestRate: Number(defaultInterestRate) || 5,
        minDeposit: 1000,
        minDuration: 30,
        penaltyPercentage: 2,
        allowEarlyWithdrawal: true,
        isQuickSaving: false,
        status: 'active',
        institutionId
    },
    {
        name: 'Share Capital',
        description: 'Mandatory shareholding product for dividend eligibility',
        type: 'fixed',
        category: 'none',
        interestRate: 0,
        minDeposit: 5000,
        minDuration: 365,
        penaltyPercentage: 0,
        allowEarlyWithdrawal: false,
        isQuickSaving: false,
        status: 'active',
        institutionId
    },
    {
        name: 'Target Savings',
        description: 'Goal-based savings product for planned expenses',
        type: 'target',
        category: 'none',
        interestRate: Number(defaultInterestRate) || 5,
        minDeposit: 1000,
        minDuration: 90,
        maxDuration: 730,
        penaltyPercentage: 3,
        allowEarlyWithdrawal: true,
        isQuickSaving: false,
        status: 'active',
        institutionId
    }
];

const buildDefaultJobConfigs = (institutionId, institutionCode) => {
    const suffix = institutionCode.toLowerCase();
    return [
        {
            jobId: `interest-calculation-${suffix}`,
            name: 'Daily Interest Calculation',
            description: 'Calculate and credit interest to savings accounts',
            cronExpression: '0 1 * * *',
            isEnabled: true,
            isSystem: true,
            category: 'finance',
            institutionId
        },
        {
            jobId: `thrift-deduction-${suffix}`,
            name: 'Monthly Thrift Deduction',
            description: 'Automatically deduct monthly thrift contributions from member accounts',
            cronExpression: '0 0 27 * *',
            isEnabled: true,
            isSystem: true,
            category: 'finance',
            institutionId
        },
        {
            jobId: `loan-repayment-${suffix}`,
            name: 'Automated Loan Repayment',
            description: 'Process automated loan repayments for due loans',
            cronExpression: '0 2 * * *',
            isEnabled: true,
            isSystem: true,
            category: 'finance',
            institutionId
        },
        {
            jobId: `autosaver-${suffix}`,
            name: 'Auto-Save Processing',
            description: 'Process matured target savings plans',
            cronExpression: '0 3 * * *',
            isEnabled: true,
            isSystem: true,
            category: 'finance',
            institutionId
        }
    ];
};

/**
 * @swagger
 * /api/v1/institutions:
 *   post:
 *     summary: Create a new institution with first admin (Super Admin only)
 *     tags: [Institutions]
 */
exports.createInstitution = catchAsync(async (req, res, next) => {
    const { name, email, phone, address, code, currency, defaultInterestRate, adminName, adminEmail, adminPassword } = req.body;

    if (!name || !email) {
        return next(new AppError('Please provide name and email for the institution', 400));
    }

    if (!adminName || !adminEmail || !adminPassword) {
        return next(new AppError('Please provide adminName, adminEmail, and adminPassword for the first institution admin', 400));
    }

    const t = await sequelize.transaction();
    let institution;
    let admin;

    // Auto-generate code if not provided
    const institutionCode = code ? code.toUpperCase() : await generateInstitutionCode();

    try {
        // Check if code exists (only if manually provided)
        if (code) {
            const existingInst = await Institution.findOne({ where: { code: institutionCode }, transaction: t });
            if (existingInst) {
                await t.rollback();
                return next(new AppError('An institution with this code already exists', 400));
            }
        }

        // Check if admin email already exists
        const existingAdmin = await User.findOne({ where: { email: adminEmail }, transaction: t });
        if (existingAdmin) {
            await t.rollback();
            return next(new AppError('Admin email already registered', 400));
        }

        // Create institution
        institution = await Institution.create({
            name,
            email,
            phone,
            address,
            code: institutionCode,
            settings: {
                currency: currency || 'NGN',
                defaultInterestRate: defaultInterestRate || 5,
                timezone: 'Africa/Lagos',
                thriftFrequency: 'monthly'
            }
        }, { transaction: t });

        // Create first admin for this institution. User model hashes the raw password.
        admin = await User.create({
            name: adminName,
            email: adminEmail,
            password: adminPassword,
            institutionId: institution.id,
            role: 'institution_admin',
            status: 'active',
            isEmailVerified: true
        }, { transaction: t });

        await Account.bulkCreate([
            {
                userId: admin.id,
                institutionId: institution.id,
                accountType: 'savings',
                accountNumber: `ADM-SAV-${admin.id.toString().padStart(8, '0')}`,
                balance: 0.00,
                status: 'active',
                openedAt: new Date()
            },
            {
                userId: admin.id,
                institutionId: institution.id,
                accountType: 'share_capital',
                accountNumber: `ADM-SHR-${admin.id.toString().padStart(8, '0')}`,
                balance: 0.00,
                status: 'active',
                openedAt: new Date()
            }
        ], { transaction: t });

        await Promise.all([
            SystemSetting.bulkCreate(buildDefaultSettings(institution.id, defaultInterestRate), { transaction: t }),
            SavingsProduct.bulkCreate(buildDefaultSavingsProducts(institution.id, defaultInterestRate), { transaction: t }),
            JobConfig.bulkCreate(buildDefaultJobConfigs(institution.id, institution.code), { transaction: t }),
            getTreasuryAccount(institution.id, t)
        ]);

        await t.commit();
    } catch (err) {
        await t.rollback();
        if (err.name === 'SequelizeUniqueConstraintError') {
            return next(new AppError('Institution setup conflicts with existing records. Please use a different institution code or admin email.', 400));
        }
        return next(err);
    }

    try {
        const superAdmins = await User.findAll({ where: { role: 'super_admin', status: 'active' } });
        for (const sa of superAdmins) {
            await sendNotification({
                userId: sa.id,
                title: 'New Cooperative Onboarded',
                message: `${institution.name} has been successfully added to the platform. Admin: ${admin.name}.`,
                type: 'success',
                link: `/superadmin/institutions/${institution.id}`
            });
        }
    } catch (err) {
        console.error('Super admin notification failed:', err);
    }

    // --- SEND WELCOME EMAILS ---
    try {
        const clientUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const loginUrl = `${clientUrl}/login`;

        // 1. Send to Admin
        const adminEmailObj = new Email(admin, loginUrl);
        await adminEmailObj.sendInstitutionWelcome(institution, adminPassword);

        // 2. Send to Institution generic email if different
        if (email && email !== adminEmail) {
            const instEmailObj = new Email({ name: institution.name, email: institution.email }, loginUrl);
            await instEmailObj.sendInstitutionWelcome(institution, adminPassword);
        }
    } catch (err) {
        console.error('Welcome email failed to send:', err);
        // We don't fail the request if email fails, but we log it
    }

    res.status(201).json({
        status: 'success',
        data: {
            institution,
            admin: {
                id: admin.id,
                name: admin.name,
                email: admin.email,
                role: admin.role
            }
        }
    });
});

/*
    Legacy implementation kept out of execution path while the creation flow is
    consolidated above.
*/
/*
        if (existingInst) {
            return next(new AppError('An institution with this code already exists', 400));
        }
    }

    // Check if admin email already exists
    const existingAdmin = await User.findOne({ where: { email: adminEmail } });
    if (existingAdmin) {
        return next(new AppError('Admin email already registered', 400));
    }

    // Create institution
    const institution = await Institution.create({
        name,
        email,
        phone,
        address,
        code: institutionCode,
        settings: {
            currency: currency || 'NGN',
            defaultInterestRate: defaultInterestRate || 5,
            timezone: 'Africa/Lagos',
            thriftFrequency: 'monthly'
        }
    });

    // Create first admin for this institution
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    const admin = await User.create({
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        institutionId: institution.id,
        role: 'institution_admin',
        status: 'active',
        isEmailVerified: true
    });

    // Create Main and Savings accounts for the admin so they can save/add funds too
    await Account.bulkCreate([
        {
            userId: admin.id,
            institutionId: institution.id,
            type: 'main',
            accountNumber: `MA${admin.id.toString().padStart(8, '0')}`,
            balance: 0.00,
            status: 'active',
            openedAt: new Date()
        },
        {
            userId: admin.id,
            institutionId: institution.id,
            type: 'savings',
            accountNumber: `SA${admin.id.toString().padStart(8, '0')}`,
            balance: 0.00,
            status: 'active',
            openedAt: new Date()
        }
    ]);

    // Notify all Super Admins of the new institution onboarding
    const superAdmins = await User.findAll({ where: { role: 'super_admin', status: 'active' } });
    for (const sa of superAdmins) {
        await sendNotification({
            userId: sa.id,
            title: 'New Cooperative Onboarded 🏢',
            message: `${institution.name} has been successfully added to the platform. Admin: ${admin.name}.`,
            type: 'success',
            link: `/superadmin/institutions/${institution.id}`
        });
    }

    // --- SEND WELCOME EMAILS ---
    try {
        const clientUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const loginUrl = `${clientUrl}/login`;
        
        // 1. Send to Admin
        const adminEmailObj = new Email(admin, loginUrl);
        await adminEmailObj.sendInstitutionWelcome(institution, adminPassword);

        // 2. Send to Institution generic email if different
        if (email && email !== adminEmail) {
            const instEmailObj = new Email({ name: institution.name, email: institution.email }, loginUrl);
            await instEmailObj.sendInstitutionWelcome(institution, adminPassword);
        }
    } catch (err) {
        console.error('Welcome email failed to send:', err);
        // We don't fail the request if email fails, but we log it
    }

    res.status(201).json({
        status: 'success',
        data: {
            institution,
            admin: {
                id: admin.id,
                name: admin.name,
                email: admin.email,
                role: admin.role
            }
        }
    });
});
*/

/**
 * @swagger
 * /api/v1/institutions/public:
 *   get:
 *     summary: Get list of active institutions for public search (Signup)
 *     tags: [Institutions]
 */
exports.getPublicInstitutions = catchAsync(async (req, res, next) => {
    const { Op } = require('sequelize');
    const { query } = req.query;

    const where = { status: 'active' };
    if (query) {
        where.name = sequelize.where(
            sequelize.fn('LOWER', sequelize.col('name')),
            'LIKE',
            `%${query.toLowerCase()}%`
        );
    }

    const institutions = await Institution.findAll({
        where,
        attributes: ['id', 'name', 'code'],
        limit: 10,
        order: [['name', 'ASC']]
    });

    res.status(200).json({
        status: 'success',
        results: institutions.length,
        data: { institutions }
    });
});

/**
 * @swagger
 * /api/v1/institutions:
 *   get:
 *     summary: Get all institutions (Super Admin only)
 *     tags: [Institutions]
 */
exports.getAllInstitutions = catchAsync(async (req, res, next) => {
    const institutions = await Institution.findAll({
        order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
        status: 'success',
        results: institutions.length,
        data: { institutions }
    });
});

/**
 * @swagger
 * /api/v1/institutions/my-institution:
 *   get:
 *     summary: Get current logged-in user's institution details
 *     tags: [Institutions]
 */
exports.getMyInstitution = catchAsync(async (req, res, next) => {
    // If user has no institution (e.g. platform super_admin), return error or null
    if (!req.institutionId) {
        return next(new AppError('You are not linked to any institution', 404));
    }

    const institution = await Institution.findByPk(req.institutionId);

    if (!institution) {
        return next(new AppError('Institution not found', 404));
    }

    res.status(200).json({
        status: 'success',
        data: { institution }
    });
});

/**
 * @swagger
 * /api/v1/institutions/{id}:
 *   patch:
 *     summary: Update institution details (Super Admin or Institution Admin)
 *     tags: [Institutions]
 */
exports.updateInstitution = catchAsync(async (req, res, next) => {
    // Determine which institution to update based on role
    const instIdToUpdate = req.user.role === 'super_admin' ? req.params.id : req.institutionId;

    if (!instIdToUpdate) {
        return next(new AppError('Institution ID is required', 400));
    }

    const institution = await Institution.findByPk(instIdToUpdate);

    if (!institution) {
        return next(new AppError('Institution not found', 404));
    }

    // Admins can update their own settings, Super Admins can update anything
    const { name, phone, address, settings, status } = req.body;

    // Build the update payload with only the fields we intend to change
    const updatePayload = {};

    if (name) updatePayload.name = name;
    if (phone !== undefined) updatePayload.phone = phone;
    if (address !== undefined) updatePayload.address = address;

    if (settings) {
        let parsedSettings = settings;
        if (typeof settings === 'string') {
            try {
                parsedSettings = JSON.parse(settings);
            } catch (err) {
                return next(new AppError('Invalid settings format', 400));
            }
        }

        // Build a COMPLETELY CLEAN settings object using only whitelisted keys.
        // We merge with existing settings to preserve other values.
        let existingSettings = institution.settings || {};
        if (typeof existingSettings === 'string') {
            try {
                existingSettings = JSON.parse(existingSettings);
            } catch (e) {
                existingSettings = {};
            }
        }

        const newSettings = {
            currency: parsedSettings.currency ?? existingSettings.currency ?? 'NGN',
            timezone: parsedSettings.timezone ?? existingSettings.timezone ?? 'Africa/Lagos',
            defaultInterestRate: parsedSettings.defaultInterestRate ?? existingSettings.defaultInterestRate ?? 5,
            thriftFrequency: parsedSettings.thriftFrequency ?? existingSettings.thriftFrequency ?? 'monthly',
            brandColor: parsedSettings.brandColor ?? existingSettings.brandColor ?? '#2563eb',
        };

        updatePayload.settings = newSettings;
    }

    if (req.file) {
        updatePayload.logoUrl = req.file.filename;
    }

    // Only super_admin can change status
    if (status && req.user.role === 'super_admin') {
        updatePayload.status = status;
    }

    // Use instance-level update and ensure JSON changes are tracked
    await institution.update(updatePayload);

    // Explicitly check if settings were updated and mark as changed if needed
    // (though instance.update() should handle this if a new object is provided)
    if (updatePayload.settings) {
        institution.changed('settings', true);
        await institution.save();
    }

    res.status(200).json({
        status: 'success',
        data: { institution }
    });
});
