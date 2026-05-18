const { JobConfig } = require('../models');
const { getJobRegistry, rescheduleJob } = require('../jobs/scheduler');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

/**
 * Get all job configurations
 */
exports.getJobConfigs = catchAsync(async (req, res, next) => {
    // Make sure defaults are seeded by calling count first. 
    // Usually scheduler handles seeding on startup, but just in case.
    const jobs = await JobConfig.findAll({
        order: [['category', 'ASC'], ['name', 'ASC']],
        include: [{ 
            association: 'operator', 
            attributes: ['name'] 
        }]
    });

    res.status(200).json({
        status: 'success',
        data: { jobs }
    });
});

/**
 * Create a new custom job from available modules
 */
exports.createJobConfig = catchAsync(async (req, res, next) => {
    const { jobId, name, description, cronExpression, category } = req.body;

    // Verify module exists
    const registry = getJobRegistry();
    if (!registry[jobId]) {
        return next(new AppError(`No backend logic module found for '${jobId}'. Cannot create job.`, 400));
    }

    // Ensure it doesn't already exist
    const existing = await JobConfig.findOne({ where: { jobId } });
    if (existing) {
        return next(new AppError(`A job with ID '${jobId}' already exists.`, 400));
    }

    const newJob = await JobConfig.create({
        jobId,
        name,
        description,
        cronExpression,
        category: category || 'custom',
        isSystem: false, // Custom jobs can be deleted
        isEnabled: true
    });

    // Schedule immediately 
    await rescheduleJob(newJob.jobId);

    res.status(201).json({
        status: 'success',
        data: { job: newJob }
    });
});

/**
 * Update an existing job configuration (cron timing, toggle on/off)
 */
exports.updateJobConfig = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { name, description, cronExpression, isEnabled } = req.body;

    const job = await JobConfig.findOne({ where: { jobId: id } });
    if (!job) {
        return next(new AppError('Job not found', 404));
    }

    // Update fields
    if (name) job.name = name;
    if (description) job.description = description;
    if (cronExpression) job.cronExpression = cronExpression;
    if (isEnabled !== undefined) job.isEnabled = isEnabled;

    await job.save();

    // Dynamically re-schedule
    await rescheduleJob(job.jobId);

    res.status(200).json({
        status: 'success',
        data: { job }
    });
});


/**
 * Manually trigger background jobs for testing/maintenance
 */
exports.runJob = catchAsync(async (req, res, next) => {
    const { jobType } = req.params;

    console.log(`[Admin] Manually triggering job: ${jobType}`);

    const registry = getJobRegistry();
    const runnerFn = registry[jobType];

    if (!runnerFn) {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid job type or no logic module found.'
        });
    }

    // Find the config to update status
    const job = await JobConfig.findOne({ where: { jobId: jobType } });
    if (job) {
        job.lastRunStatus = 'running';
        job.performedBy = req.user.id;
        await job.save();
    }

    // Run async properly (fire and forget for response logic if it's long, but here we wait)
    try {
        await runnerFn();
        if (job) {
            job.lastRunStatus = 'success';
            job.lastRunAt = new Date();
            await job.save();
        }

        res.status(200).json({
            status: 'success',
            message: `Job ${jobType} completed successfully.`
        });
    } catch (error) {
        if (job) {
            job.lastRunStatus = 'failed';
            job.lastRunAt = new Date();
            await job.save();
        }

        // Notify Super Admins of the failure
        const { User } = require('../models');
        const { sendNotification } = require('../utils/notificationService');
        const superAdmins = await User.findAll({ where: { role: 'super_admin', status: 'active' } });
        for (const sa of superAdmins) {
            await sendNotification({
                userId: sa.id,
                title: 'System Job Failure ⚠️',
                message: `Critical job '${jobType}' failed: ${error.message}`,
                type: 'error',
                link: '/superadmin/dashboard'
            });
        }

        res.status(500).json({
            status: 'error',
            message: `Job ${jobType} failed: ${error.message}`
        });
    }
});
