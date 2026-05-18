const { UserSavingsPlan, SavingsProduct, Account, Transaction, sequelize } = require('../models');
const { formatAmount } = require('../utils/accountHelper');

/**
 * Background job to process monthly interest for active savings plans
 * Runs monthly on the 1st
 */
const processMonthlyInterest = async (institutionId) => {
    console.log(`[Savings Interest Job] Starting monthly interest accrual for Institution #${institutionId || 'All'}...`);

    try {
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        const { Op } = require('sequelize');

        // Find active savings plans that haven't received interest in 30+ days
        const queryOptions = {
            where: {
                status: 'active',
                [Op.or]: [
                    { lastInterestDate: null },
                    {
                        lastInterestDate: {
                            [Op.lte]: thirtyDaysAgo
                        }
                    }
                ]
            },
            include: [
                { model: SavingsProduct, as: 'product' },
                { 
                    model: Account, 
                    as: 'account',
                    where: institutionId ? { institutionId } : {}
                }
            ]
        };

        const plansForInterest = await UserSavingsPlan.findAll(queryOptions);

        console.log(`[Savings Interest Job] Found ${plansForInterest.length} plans for interest accrual`);

        for (const plan of plansForInterest) {
            await creditMonthlyInterest(plan);
        }

        console.log('[Savings Interest Job] Completed successfully');
    } catch (error) {
        console.error('[Savings Interest Job] Error:', error);
    }
};

/**
 * Credit monthly interest to a single savings plan
 */
const creditMonthlyInterest = async (plan) => {
    const planId = plan.id;
    const annualRate = parseFloat(plan.product.interestRate);
    const currentBalance = parseFloat(plan.account.balance);

    // Calculate monthly interest: balance * (annual rate / 100 / 12)
    const monthlyInterest = currentBalance * (annualRate / 100 / 12);

    if (monthlyInterest <= 0) {
        console.log(`[Plan #${planId}] No interest to credit (balance: ₦${currentBalance}, rate: ${annualRate}%)`);
        return;
    }

    console.log(`[Plan #${planId}] Crediting interest: ₦${monthlyInterest.toFixed(2)} (Rate: ${annualRate}%, Balance: ₦${currentBalance})`);

    const t = await sequelize.transaction();

    try {
        // Update account balance
        const newBalance = currentBalance + monthlyInterest;
        await plan.account.update(
            { balance: formatAmount(newBalance) },
            { transaction: t }
        );

        // Create transaction record
        await Transaction.create({
            accountId: plan.account.id,
            userId: plan.userId,
            transactionType: 'interest_credit',
            amount: monthlyInterest,
            balanceAfter: newBalance,
            status: 'completed',
            reference: `INTEREST_${Date.now()}`,
            description: `Monthly interest for Savings Plan #${planId}`,
            performedBy: plan.userId,
            transactionDate: new Date()
        }, { transaction: t });

        // Update plan's last interest date
        await plan.update(
            { lastInterestDate: new Date() },
            { transaction: t }
        );

        await t.commit();

        console.log(`[Plan #${planId}] Interest credited successfully. New balance: ₦${newBalance.toFixed(2)}`);

    } catch (error) {
        await t.rollback();
        console.error(`[Plan #${planId}] Interest credit error:`, error);
    }
};

module.exports = { processMonthlyInterest };
