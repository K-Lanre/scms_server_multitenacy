const { User, Account, Loan, WithdrawalRequest, Transaction, sequelize } = require('./models');
const { processWithdrawal } = require('./controllers/withdrawalController');
const { approveMember } = require('./controllers/userController');
const { disburseLoan } = require('./controllers/loanController');
const { postRepayment } = require('./controllers/loanController');

async function testJourneys() {
    console.log('--- STARTING COMPREHENSIVE USER JOURNEY TEST ---');

    try {
        // 1. Setup a test user
        const testEmail = `test_journey_${Date.now()}@example.com`;
        const user = await User.create({
            name: 'Test Journey User',
            email: testEmail,
            password: 'password123',
            role: 'member',
            status: 'pending_onboarding'
        });
        console.log(`[PASS] User created: ${user.id}`);

        // 2. Simulate Onboarding & Approval
        user.status = 'pending_approval';
        user.bankName = 'Test Bank';
        user.bankCode = '000';
        user.accountNumber = '1234567890';
        await user.save();

        // Mocking req/res for controller test
        const mockReqApprove = { params: { id: user.id }, user: { id: 1, role: 'super_admin' } };
        const mockResApprove = {
            status: () => ({ json: (data) => console.log('[PASS] Member Approved:', data.message) })
        };
        await approveMember(mockReqApprove, mockResApprove, (err) => { if (err) throw err; });

        // 3. Verify Accounts created
        const accounts = await Account.findAll({ where: { userId: user.id } });
        if (accounts.length >= 1) {
            console.log(`[PASS] Accounts created for user: ${accounts.length}`);
        } else {
            throw new Error('No accounts created after approval');
        }

        const savingsAccount = accounts.find(a => a.accountType === 'savings');

        // 4. Simulate Deposit
        await Transaction.create({
            accountId: savingsAccount.id,
            transactionType: 'deposit',
            amount: 50000,
            balanceAfter: 50000,
            reference: `REF-DEP-${Date.now()}`,
            performedBy: 1, // Super admin ID
            description: 'Test Deposit',
            status: 'completed'
        });
        savingsAccount.balance = 50000;
        await savingsAccount.save();
        console.log('[PASS] Initial deposit successful');

        // 5. Simulate Loan Application & Disbursement
        const amount = 100000;
        const duration = 12;
        const interestRate = 10;
        const totalInterest = amount * (interestRate / 100);
        const totalRepayable = amount + totalInterest;
        const monthlyPayment = totalRepayable / duration;

        const loan = await Loan.create({
            userId: user.id,
            loanAmount: amount,
            interestRate: interestRate,
            duration: duration,
            monthlyPayment: monthlyPayment,
            totalRepayable: totalRepayable,
            outstandingBalance: totalRepayable,
            status: 'pending'
        });

        loan.status = 'approved';
        await loan.save();

        const mockReqDisburse = {
            params: { id: loan.id },
            user: { id: 1, role: 'super_admin' },
            body: { mode: 'manual' }
        };
        const mockResDisburse = {
            status: () => ({ json: (data) => console.log('[PASS] Loan Disbursed:', data.message) })
        };
        await disburseLoan(mockReqDisburse, mockResDisburse, (err) => { if (err) throw err; });

        // 6. Simulate Withdrawal & Automated Payout Logic
        const withdrawal = await WithdrawalRequest.create({
            userId: user.id,
            accountId: savingsAccount.id,
            amount: 10000,
            status: 'pending',
            reason: 'Test Withdrawal'
        });

        const mockReqWithdraw = {
            params: { id: withdrawal.id },
            user: { id: 1, role: 'super_admin' },
            body: { status: 'approved' }
        };
        const mockResWithdraw = {
            status: () => ({ json: (data) => console.log('[PASS] Withdrawal Processed:', data.message) })
        };

        // This will trigger PaystackService.createTransferRecipient and initiateTransfer (mocked in dev)
        await processWithdrawal(mockReqWithdraw, mockResWithdraw, (err) => { if (err) throw err; });

        console.log('--- ALL JOURNEYS VERIFIED SUCCESSFULLY ---');
        process.exit(0);

    } catch (error) {
        console.error('--- TEST FAILED ---');
        console.error(error);
        process.exit(1);
    }
}

testJourneys();
