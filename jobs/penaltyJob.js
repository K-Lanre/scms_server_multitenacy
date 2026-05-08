const { Contribution, Levy, SystemSetting, Notification, sequelize } = require('../models');

/**
 * Identify defaulted contributions from the previous month and issue penalties
 * Runs on the 1st of every month
 */
const processThriftPenalties = async (institutionId) => {
    try {
        console.log(`[Job] Starting Thrift Penalty Processing for Institution #${institutionId || 'All'}...`);
        
        // 1. Determine the PREVIOUS month
        const now = new Date();
        let prevMonthYear = now.getFullYear();
        let prevMonthNum = now.getMonth(); // 0-indexed, so 0 is Jan, and now is Feb
        
        if (prevMonthNum === 0) {
            prevMonthNum = 12;
            prevMonthYear -= 1;
        }
        
        const previousMonth = `${prevMonthYear}-${String(prevMonthNum).padStart(2, '0')}`;
        console.log(`[Job] Scanning for defaults in ${previousMonth}...`);

        // 2. Get penalty amount from settings
        const setting = await SystemSetting.findOne({ where: { key: 'thrift_penalty_amount' } });
        const penaltyAmount = parseFloat(setting?.value || 1000);

        // 3. Find all contributions from previous month that are still pending
        const queryOptions = {
            where: {
                month: previousMonth,
                status: 'pending'
            }
        };

        if (institutionId) {
            queryOptions.where.institutionId = institutionId;
        }

        const defaults = await Contribution.findAll(queryOptions);

        console.log(`[Job] Found ${defaults.length} defaults for ${previousMonth}.`);

        let penalizedCount = 0;

        for (const contribution of defaults) {
            const t = await sequelize.transaction();
            try {
                // 4. Mark contribution as defaulted
                await contribution.update({ status: 'defaulted' }, { transaction: t });

                // 5. Issue Levy (Fine)
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 7); // 7 days from now

                await Levy.create({
                    userId: contribution.userId,
                    institutionId: contribution.institutionId,
                    name: `Late Thrift Penalty - ${previousMonth}`,
                    amount: penaltyAmount,
                    status: 'pending',
                    dueDate: dueDate
                }, { transaction: t });

                // 6. Notify Member
                await Notification.create({
                    userId: contribution.userId,
                    institutionId: contribution.institutionId,
                    title: 'Penalty Issued: Late Thrift',
                    message: `You have been fined ₦${penaltyAmount.toLocaleString()} for defaulting on your ${previousMonth} thrift contribution. Please pay your levy to avoid further sanctions.`,
                    type: 'error',
                    referenceType: 'levy',
                    link: '/savings'
                }, { transaction: t });

                await t.commit();
                penalizedCount++;
            } catch (err) {
                await t.rollback();
                console.error(`[Job] Error penalizing User ${contribution.userId}:`, err.message);
            }
        }

        console.log(`[Job] ✅ Penalty Processing Completed: ${penalizedCount} fines issued.`);
    } catch (error) {
        console.error('[Job] ❌ Error in processThriftPenalties:', error);
    }
};

module.exports = { processThriftPenalties };
