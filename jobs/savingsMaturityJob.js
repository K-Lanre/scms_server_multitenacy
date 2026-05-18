const { UserSavingsPlan, Account, User, Transaction, sequelize } = require('../models');
const { formatAmount } = require('../utils/accountHelper');
const { recordTransaction } = require('../utils/transactionHelper');
const Email = require('../utils/email');

/**
 * Background job to process matured savings plans
 * Runs daily at 4:00 AM
 */
const processMaturedPlans = async (institutionId) => {
    console.log(`[Savings Maturity Job] Checking for matured plans for Institution #${institutionId || 'All'}...`);

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { Op } = require('sequelize');

        // Find matured plans
        const queryOptions = {
            where: {
                maturityDate: {
                    [Op.lte]: today
                },
                status: 'active'
            },
            include: [
                { 
                    model: Account, 
                    as: 'account',
                    where: institutionId ? { institutionId } : {}
                },
                { model: User, as: 'user' }
            ]
        };

        const maturedPlans = await UserSavingsPlan.findAll(queryOptions);

        console.log(`[Savings Maturity Job] Found ${maturedPlans.length} matured plans`);

        for (const plan of maturedPlans) {
            await processPlanMaturity(plan);
        }

        console.log('[Savings Maturity Job] Completed successfully');
    } catch (error) {
        console.error('[Savings Maturity Job] Error:', error);
    }
};

/**
 * Process maturity for a single savings plan
 */
const processPlanMaturity = async (plan) => {
    const planId = plan.id;
    const userId = plan.userId;
    const planBalance = parseFloat(plan.account.balance);

    console.log(`[Plan #${planId}] Processing maturity. Balance: ₦${planBalance}`);

    if (planBalance <= 0) {
        console.log(`[Plan #${planId}] No balance to transfer, marking as completed`);
        await plan.update({ status: 'completed' });
        await plan.account.update({ status: 'closed', closedAt: new Date() });
        return;
    }

    const t = await sequelize.transaction();

    try {
        // Find user's main savings account
        const mainSavingsAccount = await Account.findOne({
            where: { userId, accountType: 'savings' }
        });

        if (!mainSavingsAccount) {
            console.error(`[Plan #${planId}] Main savings account not found for user ${userId}`);
            await t.rollback();
            return;
        }

        // Transfer balance from plan account to main savings account
        // 1. Debit plan account
        await recordTransaction({
            accountId: plan.account.id,
            transactionType: 'transfer_out',
            amount: planBalance,
            description: `Maturity transfer to main account from Plan #${planId}`,
            performedBy: userId,
            t
        });

        // 2. Credit main savings account
        await recordTransaction({
            accountId: mainSavingsAccount.id,
            transactionType: 'transfer_in',
            amount: planBalance,
            description: `Maturity proceeds from Savings Plan #${planId}`,
            performedBy: userId,
            t
        });

        // 3. Update plan status
        await plan.update({ status: 'completed' }, { transaction: t });

        // 4. Close plan account
        await plan.account.update(
            { status: 'closed', closedAt: new Date() },
            { transaction: t }
        );

        await t.commit();

        console.log(`[Plan #${planId}] Maturity processed. ₦${planBalance} transferred to main account`);

        // Send email notification
        try {
            await new Email(plan.user, '').sendSavingsMaturityNotice(plan, planBalance);
            console.log(`[Plan #${planId}] Maturity notice email sent`);
        } catch (emailError) {
            console.error(`[Plan #${planId}] Failed to send email:`, emailError.message);
        }

    } catch (error) {
        await t.rollback();
        console.error(`[Plan #${planId}] Maturity processing error:`, error);
    }
};

module.exports = { processMaturedPlans };
