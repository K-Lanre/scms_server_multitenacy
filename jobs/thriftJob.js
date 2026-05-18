const { Contribution, User, Account, Transaction, Notification, SystemSetting, sequelize } = require('../models');
const { getTreasuryAccount } = require('../utils/treasuryManager');
const { generateReference } = require('../utils/accountHelper');

/**
 * GENERATION JOB: Runs once a month to create pending thrift/commission records
 */
const processMonthlyThrift = async (institutionId) => {
    try {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        console.log(`[Job] Starting Monthly Thrift Generation for ${currentMonth} (Inst: ${institutionId || 'All'})...`);

        // Check if records already exist for this month to prevent double generation
        // Note: In a multi-tenant setup, we might need to check per-tenant, but for now we check globally
        // Or better, check if ANY records exist for this month and this institution if we had that mapping in Contribution
        // Since Contribution doesn't have institutionId directly, we filter members first.
        
        const thriftSetting = await SystemSetting.findOne({ where: { key: 'monthly_thrift_amount' } });
        const commissionSetting = await SystemSetting.findOne({ where: { key: 'monthly_commission_amount' } });
        
        const thriftAmount = parseFloat(thriftSetting?.value || 5000);
        const commissionAmount = parseFloat(commissionSetting?.value || 500);

        const memberQuery = { where: { role: 'member', status: 'active' } };
        if (institutionId) {
            memberQuery.where.institutionId = institutionId;
        }
        const members = await User.findAll(memberQuery);

        let createdCount = 0;
        for (const member of members) {
            // Thrift
            await Contribution.create({
                userId: member.id,
                institutionId: member.institutionId,
                month: currentMonth,
                amount: thriftAmount,
                type: 'thrift',
                status: 'pending'
            }).catch(() => {}); // Unique index in DB will catch duplicates if check fails

            // Commission
            await Contribution.create({
                userId: member.id,
                institutionId: member.institutionId,
                month: currentMonth,
                amount: commissionAmount,
                type: 'commission',
                status: 'pending'
            }).catch(() => {});

            createdCount += 2;
            
            // Notify
            await Notification.create({
                userId: member.id,
                institutionId: member.institutionId,
                title: 'Monthly Obligations Generated',
                message: `Your thrift (₦${thriftAmount.toLocaleString()}) and commission (₦${commissionAmount.toLocaleString()}) for ${currentMonth} have been generated and are pending collection.`,
                type: 'info',
                referenceType: 'contribution',
                link: '/savings'
            }).catch(() => {});
        }

        console.log(`[Job] ✅ Successfully generated ${createdCount} records for ${currentMonth}`);
    } catch (error) {
        console.error('[Job] ❌ Error in processMonthlyThrift:', error);
    }
};

/**
 * DEDUCTION JOB: Runs once a month to automatically collect pending thrifts/commissions
 */
const processThriftDeductions = async (institutionId) => {
    try {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        console.log(`[Job] Starting Monthly Thrift Deductions for ${currentMonth} (Inst: ${institutionId || 'All'})...`);

        const obligationQuery = {
            where: {
                month: currentMonth,
                status: 'pending'
            }
        };

        if (institutionId) {
            obligationQuery.where.institutionId = institutionId;
        }

        const obligations = await Contribution.findAll(obligationQuery);

        console.log(`[Job] Found ${obligations.length} pending obligations to collect.`);

        let successCount = 0;
        let failedCount = 0;

        for (const obligation of obligations) {
            const t = await sequelize.transaction();
            try {
                const memberAccount = await Account.findOne({
                    where: { userId: obligation.userId, accountType: 'savings', status: 'active' },
                    transaction: t
                });

                const adminAccount = await getTreasuryAccount(memberAccount.institutionId, t);
                const amount = parseFloat(obligation.amount);

                if (!memberAccount || parseFloat(memberAccount.balance) < amount) {
                    await t.rollback();
                    // Mark as failed_insufficient for this attempt
                    await obligation.update({ status: 'failed_insufficient' });
                    failedCount++;
                    continue;
                }

                // Perform Transfer: Member -> Admin
                const newMemberBalance = parseFloat(memberAccount.balance) - amount;
                const newAdminBalance = parseFloat(adminAccount.balance) + amount;

                await memberAccount.update({ balance: newMemberBalance }, { transaction: t });
                await adminAccount.update({ balance: newAdminBalance }, { transaction: t });

                const transaction = await Transaction.create({
                    accountId: memberAccount.id,
                    transactionType: 'withdrawal',
                    amount,
                    balanceAfter: newMemberBalance,
                    reference: generateReference(),
                    description: `Auto-Collection: ${obligation.type} - ${obligation.month}`,
                    status: 'completed',
                    completedAt: new Date()
                }, { transaction: t });

                await Transaction.create({
                    accountId: adminAccount.id,
                    transactionType: 'deposit',
                    amount,
                    balanceAfter: newAdminBalance,
                    reference: generateReference(),
                    description: `Admin Pool Received: ${obligation.type} - ${obligation.month} (User #${obligation.userId})`,
                    status: 'completed',
                    completedAt: new Date(),
                    linkedTransactionId: transaction.id
                }, { transaction: t });

                await obligation.update({
                    status: 'paid',
                    collectionMethod: 'automatic',
                    paidAt: new Date(),
                    transactionId: transaction.id
                }, { transaction: t });

                await t.commit();
                successCount++;
            } catch (err) {
                await t.rollback();
                console.error(`[Job] Error processing User ${obligation.userId}:`, err.message);
                failedCount++;
            }
        }

        console.log(`[Job] ✅ Deductions Completed: ${successCount} Success, ${failedCount} Failed.`);
    } catch (error) {
        console.error('[Job] ❌ Error in processThriftDeductions:', error);
    }
};

module.exports = { 
    processMonthlyThrift, 
    processThriftDeductions 
};
