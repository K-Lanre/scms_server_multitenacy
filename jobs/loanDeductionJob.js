const { Loan, Account, User, LoanRepayment, Transaction, sequelize, Notification } = require('../models');
const { formatAmount } = require('../utils/accountHelper');
const Email = require('../utils/email');
const { sendNotification } = require('../utils/notificationService');

/**
 * Background job to process automated monthly loan deductions
 * Runs daily to check for loans due for monthly payment
 */
const processAutomatedDeductions = async (institutionId) => {
    console.log(`[Loan Deduction Job] Starting automated loan deductions for Institution #${institutionId || 'All'}...`);

    try {
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        // Find loans that need deduction
        const { Op } = require('sequelize');
        
        const queryOptions = {
            where: {
                repaymentMode: 'automated',
                status: {
                    [Op.in]: ['disbursed', 'repaying', 'defaulted']
                },
                outstandingBalance: {
                    [Op.gt]: 0
                },
                [Op.or]: [
                    { lastDeductionDate: null },
                    {
                        lastDeductionDate: {
                            [Op.lte]: thirtyDaysAgo
                        }
                    }
                ]
            },
            include: [{ model: User, as: 'borrower' }]
        };

        // Filter by institution if provided
        if (institutionId) {
            queryOptions.where.institutionId = institutionId;
        }

        const loansForDeduction = await Loan.findAll(queryOptions);

        console.log(`[Loan Deduction Job] Found ${loansForDeduction.length} loans for deduction`);

        for (const loan of loansForDeduction) {
            await processLoanDeduction(loan);
        }

        console.log('[Loan Deduction Job] Completed successfully');
    } catch (error) {
        console.error('[Loan Deduction Job] Error:', error);
    }
};

/**
 * Process deduction for a single loan
 */
const processLoanDeduction = async (loan) => {
    const loanId = loan.id;
    const userId = loan.userId;
    const deductionAmount = parseFloat(loan.monthlyDeductionAmount);

    console.log(`[Loan #${loanId}] Processing deduction of ₦${deductionAmount}`);

    const t = await sequelize.transaction();

    try {
        // Find user's savings account
        const account = await Account.findOne({
            where: { userId, accountType: 'savings' }
        });

        if (!account) {
            console.error(`[Loan #${loanId}] No savings account found for user ${userId}`);
            await t.rollback();
            return;
        }

        const accountBalance = parseFloat(account.balance);

        // Check if sufficient balance
        if (accountBalance < deductionAmount) {
            console.warn(`[Loan #${loanId}] Insufficient balance: ₦${accountBalance} < ₦${deductionAmount}`);

            // Increment failed count
            const newFailedCount = loan.failedDeductionCount + 1;
            await loan.update({ failedDeductionCount: newFailedCount }, { transaction: t });

            await t.commit();

            // Send email notification
            try {
                await new Email(loan.borrower, '').sendFailedDeductionNotice(loan, newFailedCount);
                console.log(`[Loan #${loanId}] Failed deduction email sent (${newFailedCount}/3)`);
            } catch (emailError) {
                console.error(`[Loan #${loanId}] Failed to send email:`, emailError.message);
            }

            // If 3 failures, trigger default handling
            if (newFailedCount >= 3) {
                console.warn(`[Loan #${loanId}] 3 consecutive failures - will be handled by default job`);
            }

            return;
        }

        // Sufficient balance - process deduction
        const newBalance = accountBalance - deductionAmount;

        // Calculate principal and interest portions
        const principalPortion = (deductionAmount * parseFloat(loan.loanAmount)) / parseFloat(loan.totalRepayable);
        const interestPortion = deductionAmount - principalPortion;

        // Update account balance
        await account.update({ balance: formatAmount(newBalance) }, { transaction: t });

        // Create transaction record
        const transaction = await Transaction.create({
            accountId: account.id,
            userId,
            transactionType: 'loan_repayment',
            amount: deductionAmount,
            balanceAfter: newBalance,
            status: 'completed',
            reference: `AUTO_DEDUCT_${Date.now()}`,
            description: `Automated loan repayment for Loan #${loanId}`,
            performedBy: userId,
            transactionDate: new Date()
        }, { transaction: t });

        // Create loan repayment record
        await LoanRepayment.create({
            loanId: loan.id,
            transactionId: transaction.id,
            amount: formatAmount(deductionAmount),
            principal: formatAmount(principalPortion),
            interest: formatAmount(interestPortion),
            paidAt: new Date()
        }, { transaction: t });

        // Update loan
        const newOutstanding = parseFloat(loan.outstandingBalance) - deductionAmount;
        const newStatus = newOutstanding <= 0 ? 'completed' : 'repaying';

        await loan.update({
            outstandingBalance: formatAmount(Math.max(0, newOutstanding)),
            status: newStatus,
            lastDeductionDate: new Date(),
            failedDeductionCount: 0, // Reset failure count on successful payment
            completedAt: newStatus === 'completed' ? new Date() : loan.completedAt
        }, { transaction: t });

        await t.commit();

        // Notifications & Alerts for Completion
        if (newStatus === 'completed') {
            try {
                // Notify admins
                const { Op } = require('sequelize');
                const admins = await User.findAll({
                    where: { role: { [Op.in]: ['admin', 'super_admin', 'staff'] }, status: 'approved' }
                });

                for (const admin of admins) {
                    await sendNotification({
                        userId: admin.id,
                        title: 'Loan Fully Repaid (Auto) 💰',
                        message: `Member ${loan.userId} has successfully paid off Loan #${loan.id} via automated deduction.`,
                        type: 'success',
                        link: `/admin/loan-portfolio`
                    });
                }

                // Notify member
                await sendNotification({
                    userId: loan.userId,
                    title: 'Congratulations! Loan Completed 🎉',
                    message: `Your loan (Loan #${loan.id}) has been fully repaid via automated deduction.`,
                    type: 'success',
                    link: '/loans/my-loans'
                });
            } catch (notifyErr) {
                console.error(`[Loan #${loanId}] Completion notification failed:`, notifyErr.message);
            }
        }

        console.log(`[Loan #${loanId}] Deduction successful. New outstanding: ₦${Math.max(0, newOutstanding)}, Status: ${newStatus}`);

    } catch (error) {
        await t.rollback();
        console.error(`[Loan #${loanId}] Deduction error:`, error);
    }
};

module.exports = { processAutomatedDeductions };
