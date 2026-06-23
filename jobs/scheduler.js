const cron = require('node-cron');
const { JobConfig } = require('../models');

// Job functional modules
const { processAutomatedDeductions } = require('./loanDeductionJob');
const { processMonthlyInterest } = require('./savingsInterestJob');
const { processMaturedPlans } = require('./savingsMaturityJob');
const { processThriftPenalties } = require('./penaltyJob');
const { processMonthlyThrift, processThriftDeductions } = require('./thriftJob');

// Registry mapping DB jobId to actual functions
// Includes both legacy names and new seeder-based names
const jobRegistry = {
    // Legacy / Default names
    'loan-deductions': processAutomatedDeductions,
    'savings-interest': processMonthlyInterest,
    'savings-maturity': processMaturedPlans,
    'thrift-penalties': processThriftPenalties,
    'monthly-thrift': processMonthlyThrift,
    'thrift-deductions': processThriftDeductions,

    // New Seeder-based names (matched by base jobId)
    'interest-calculation': processMonthlyInterest,
    'thrift-deduction': processThriftDeductions,
    'loan-repayment': processAutomatedDeductions,
    'autosaver': processMaturedPlans,
    'notification-cleanup': async (instId) => {
        console.log(`[Maintenance] Cleaning up notifications for Institution #${instId || 'All'}`);
        // TODO: Implement actual cleanup logic
    },
    'audit-log-archive': async (instId) => {
        console.log(`[Maintenance] Archiving audit logs for Institution #${instId || 'All'}`);
        // TODO: Implement actual archiving logic
    },
    'unverified-user-cleanup': async () => {
        const { Op } = require('sequelize');
        const { User } = require('../models');
        console.log('[Maintenance] Running expired unverified user cleanup...');
        try {
            const result = await User.destroy({
                where: {
                    isEmailVerified: false,
                    emailVerificationExpires: {
                        [Op.lt]: new Date()
                    }
                }
            });
            console.log(`[Maintenance] Cleaned up ${result} expired unverified user records.`);
        } catch (error) {
            console.error('[Maintenance] Failed to clean up expired unverified users:', error);
            throw error;
        }
    }
};

// Default seeds to populate if DB table is empty
const defaultJobs = [
    { jobId: 'savings-interest', name: 'Savings Interest Posting', description: 'Calculates and credits interest to all active savings products.', cronExpression: '0 1 1 * *', isEnabled: true, isSystem: true, category: 'savings' },
    { jobId: 'loan-deductions', name: 'Automated Loan Deductions', description: 'Triggers primary savings debits for all due loan installments.', cronExpression: '0 2 * * *', isEnabled: true, isSystem: true, category: 'loans' },
    { jobId: 'savings-maturity', name: 'Savings Maturity Processing', description: 'Processes matured target savings plans.', cronExpression: '0 4 * * *', isEnabled: true, isSystem: true, category: 'savings' },
    { jobId: 'thrift-penalties', name: 'Monthly Thrift Penalty', description: 'Applies penalties for unpaid thrift.', cronExpression: '0 5 1 * *', isEnabled: true, isSystem: true, category: 'thrift' },
    { jobId: 'monthly-thrift', name: 'Monthly Thrift Generation', description: 'Generates thrift and commission records for all members.', cronExpression: '0 0 1 * *', isEnabled: true, isSystem: true, category: 'thrift' },
    { jobId: 'thrift-deductions', name: 'Automated Thrift Deductions', description: 'Automatically collects thrift from member savings balance.', cronExpression: '0 1 1 * *', isEnabled: true, isSystem: true, category: 'thrift' },
    { jobId: 'unverified-user-cleanup', name: 'Unverified User Cleanup', description: 'Deletes unverified user accounts where the verification window has expired.', cronExpression: '0 3 * * *', isEnabled: true, isSystem: true, category: 'maintenance' },
];

let activeCronTasks = {};

/**
 * Initialize all scheduled jobs dynamically from the database
 */
const startScheduler = async () => {
    console.log('[Scheduler] Initializing dynamic cron jobs...');

    try {
        // 1. Seed defaults if empty or missing
        for (const defaultJob of defaultJobs) {
            const exists = await JobConfig.findOne({ where: { jobId: defaultJob.jobId } });
            if (!exists) {
                console.log(`[Scheduler] Seeding missing default job: ${defaultJob.name}`);
                await JobConfig.create(defaultJob);
            }
        }

        // 2. Load all enabled jobs from DB
        const jobs = await JobConfig.findAll({ where: { isEnabled: true } });

        console.log(`[Scheduler] Found ${jobs.length} enabled jobs in database.`);

        // 3. Schedule them
        for (const job of jobs) {
            // Support both direct match and base-name match (for suffixed jobIds like interest-calculation-coop001)
            const baseJobId = job.jobId.includes('-') && !jobRegistry[job.jobId] 
                ? job.jobId.split('-').slice(0, -1).join('-') 
                : job.jobId;
            
            const runnerFn = jobRegistry[job.jobId] || jobRegistry[baseJobId];

            if (!runnerFn) {
                console.warn(`[Scheduler] Warning: Function not found for jobId ${job.jobId} (Base: ${baseJobId}). Skipping.`);
                continue;
            }

            // Create and store cron task
            const task = cron.schedule(job.cronExpression, async () => {
                console.log(`[Scheduler] Executing scheduled job: ${job.name} [${job.jobId}]...`);
                job.lastRunStatus = 'running';
                await job.save();

                try {
                    // Pass institutionId to the runner function
                    await runnerFn(job.institutionId);
                    job.lastRunStatus = 'success';
                } catch (error) {
                    console.error(`[Scheduler] Job ${job.name} failed:`, error);
                    job.lastRunStatus = 'failed';
                }

                job.lastRunAt = new Date();
                await job.save();

            }, {
                scheduled: true,
                timezone: "Africa/Lagos"
            });

            activeCronTasks[job.jobId] = task;
            console.log(`[Scheduler] ✅ Scheduled [${job.name}] (${job.jobId}) with cron: ${job.cronExpression}`);
        }

        console.log('[Scheduler] Dynamic jobs initialization complete.');

        // ✅ CATCH-UP MECHANISM: Run any jobs that were missed due to server downtime
        await checkAndRunMissedJobs();

    } catch (error) {
        console.error('[Scheduler] Failed to initialize dynamic jobs:', error);
    }
};

/**
 * On startup, check if any time-sensitive jobs were missed this month/day
 * and run them immediately if they haven't completed successfully.
 */
const checkAndRunMissedJobs = async () => {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = now.getDate();

        console.log(`[Scheduler] Running missed-job catch-up check...`);
        
        // --- Check: Monthly Thrift Generation ---
        const thriftGenJob = await JobConfig.findOne({ where: { jobId: 'monthly-thrift' } });
        if (thriftGenJob && thriftGenJob.isEnabled) {
            const cronParts = thriftGenJob.cronExpression.split(' ');
            const targetDay = cronParts.length >= 3 && cronParts[2] !== '*' ? parseInt(cronParts[2], 10) : 1;

            if (day >= targetDay) {
                const lastRun = thriftGenJob.lastRunAt;
                const ranThisMonth = lastRun &&
                    lastRun.getFullYear() === year &&
                    lastRun.getMonth() + 1 === parseInt(month, 10);

                if (!ranThisMonth || thriftGenJob.lastRunStatus === 'failed') {
                    console.log('[Scheduler] ⚠️  monthly-thrift missed! Running now as catch-up...');
                    const runnerFn = jobRegistry['monthly-thrift'];
                    if (runnerFn) {
                        thriftGenJob.lastRunStatus = 'running';
                        await thriftGenJob.save();
                        try {
                            await runnerFn();
                            thriftGenJob.lastRunStatus = 'success';
                        } catch (e) {
                            thriftGenJob.lastRunStatus = 'failed';
                        }
                        thriftGenJob.lastRunAt = new Date();
                        await thriftGenJob.save();
                    }
                }
            }
        }

        // --- Check: Thrift Deductions ---
        const deductJob = await JobConfig.findOne({ where: { jobId: 'thrift-deductions' } });
        if (deductJob && deductJob.isEnabled) {
            const cronParts = deductJob.cronExpression.split(' ');
            const targetDay = cronParts.length >= 3 && cronParts[2] !== '*' ? parseInt(cronParts[2], 10) : 1;

            if (day >= targetDay) {
                const lastRun = deductJob.lastRunAt;
                const ranThisMonth = lastRun &&
                    lastRun.getFullYear() === year &&
                    lastRun.getMonth() + 1 === parseInt(month, 10);

                if (!ranThisMonth || deductJob.lastRunStatus === 'failed') {
                    console.log('[Scheduler] ⚠️  thrift-deductions missed! Running now as catch-up...');
                    const runnerFn = jobRegistry['thrift-deductions'];
                    if (runnerFn) {
                        deductJob.lastRunStatus = 'running';
                        await deductJob.save();
                        try {
                            await runnerFn();
                            deductJob.lastRunStatus = 'success';
                        } catch (e) {
                            deductJob.lastRunStatus = 'failed';
                        }
                        deductJob.lastRunAt = new Date();
                        await deductJob.save();
                    }
                }
            }
        }

        console.log('[Scheduler] Missed-job catch-up check complete.');
    } catch (err) {
        console.error('[Scheduler] Error during missed-job catch-up check:', err.message);
    }
};

/**
 * Helper to resync a single job (used if admin edits from UI)
 */
const rescheduleJob = async (jobId) => {
    // 1. Stop existing if running
    if (activeCronTasks[jobId]) {
        activeCronTasks[jobId].stop();
        delete activeCronTasks[jobId];
        console.log(`[Scheduler] Stopped old process for job: ${jobId}`);
    }

    // 2. Fetch updated config
    const job = await JobConfig.findOne({ where: { jobId } });
    if (!job || !job.isEnabled) {
        return; // Left stopped
    }

    const runnerFn = jobRegistry[job.jobId];
    if (!runnerFn) return;

    // 3. Reschedule
    activeCronTasks[job.jobId] = cron.schedule(job.cronExpression, async () => {
        console.log(`[Scheduler] Executing rescheduled job: ${job.name}...`);
        job.lastRunStatus = 'running';
        await job.save();
        try {
            await runnerFn();
            job.lastRunStatus = 'success';
        } catch (error) {
            job.lastRunStatus = 'failed';
        }
        job.lastRunAt = new Date();
        await job.save();
    }, { scheduled: true, timezone: "Africa/Lagos" });

    console.log(`[Scheduler] ✅ Rescheduled [${job.name}] with new cron: ${job.cronExpression}`);
};

const getJobRegistry = () => jobRegistry;

// Export individual job functions for manual testing, plus new dynamic tools
module.exports = {
    startScheduler,
    rescheduleJob,
    getJobRegistry,
    // Original exports (for backward compatibility if runJob controller uses them directly,
    // though we will update jobController to use getJobRegistry soon)
    processAutomatedDeductions,
    processMonthlyInterest,
    processMaturedPlans,
    processThriftPenalties
};
