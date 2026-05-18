'use strict';

const helpers = require('./utils/seederHelpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('💳 Seeding Loans and Loan Repayments...');
      
      // Clear existing data
      await queryInterface.bulkDelete('LoanRepayments', null, { transaction });
      await queryInterface.bulkDelete('Loans', null, { transaction });
      
      const now = new Date();
      const loans = [];
      const repayments = [];
      
      // Get members with their institutions and savings account balances
      const [members] = await queryInterface.sequelize.query(
        `SELECT u.id, u.institutionId, u.email, a.balance as savingsBalance
         FROM Users u
         JOIN Accounts a ON u.id = a.userId AND a.accountType = 'savings'
         WHERE u.role = 'member'
         ORDER BY u.id`,
        { transaction }
      );
      
      // Get admin users for approval
      const [admins] = await queryInterface.sequelize.query(
        `SELECT id, institutionId FROM Users 
         WHERE role IN ('super_admin', 'institution_admin') 
         ORDER BY id`,
        { transaction }
      );
      
      // Helper to get admin for institution
      function getApprover(institutionId) {
        const institutionAdmin = admins.find(a => a.institutionId === institutionId);
        const superAdmin = admins.find(a => a.institutionId === null);
        return institutionAdmin ? institutionAdmin.id : (superAdmin ? superAdmin.id : 1);
      }
      
      // Create loans for 40% of members
      const membersWithLoans = members.filter(() => Math.random() < 0.4);
      
      membersWithLoans.forEach(member => {
        const approverId = getApprover(member.institutionId);
        
        // Loan status distribution
        const statuses = ['pending', 'approved', 'disbursed', 'repaying', 'completed', 'defaulted'];
        const weights = [0.15, 0.1, 0.1, 0.3, 0.2, 0.15];
        const status = helpers.pickRandom(statuses.map((s, i) => Array(weights[i] * 100).fill(s)).flat());
        
        // Calculate loan amount based on savings (50% to 300% of savings)
        const savings = parseFloat(member.savingsBalance);
        const loanAmount = Math.max(50000, Math.round(savings * helpers.randomAmount(50, 300) / 100 / 1000) * 1000);
        
        // Interest rate (5-12%)
        const interestRate = helpers.randomAmount(5, 12);
        const duration = helpers.randomAmount(3, 12); // 3-12 months
        
        // Calculate repayment details
        const totalRepayable = loanAmount + (loanAmount * (interestRate / 100));
        const monthlyPayment = totalRepayable / duration;
        
        // Determine dates based on status
        let disbursedAt = null;
        let dueDate = null;
        let originalDueDate = null;
        let nextPaymentDate = null;
        let completedAt = null;
        let outstandingBalance = loanAmount;
        let failedDeductionCount = 0;
        
        if (['disbursed', 'repaying', 'completed', 'defaulted'].includes(status)) {
          disbursedAt = helpers.getOffsetDate(-helpers.randomAmount(30, 180));
          originalDueDate = new Date(disbursedAt);
          originalDueDate.setMonth(originalDueDate.getMonth() + duration);
          dueDate = originalDueDate;
          outstandingBalance = totalRepayable;
        }
        
        if (status === 'repaying') {
          nextPaymentDate = helpers.getOffsetDate(helpers.randomAmount(1, 30));
          // Make some payments
          const monthsPaid = helpers.randomAmount(1, Math.max(1, duration - 2));
          const paidAmount = monthlyPayment * monthsPaid;
          outstandingBalance = Math.max(0, totalRepayable - paidAmount);
        }
        
        if (status === 'completed') {
          completedAt = helpers.getOffsetDate(-helpers.randomAmount(1, 30));
          outstandingBalance = 0;
        }
        
        if (status === 'defaulted') {
          failedDeductionCount = helpers.randomAmount(2, 5);
          const monthsPaid = helpers.randomAmount(0, Math.max(1, duration - 3));
          const paidAmount = monthlyPayment * monthsPaid;
          outstandingBalance = totalRepayable - paidAmount;
        }
        
        const loanId = loans.length + 1; // Sequential ID for reference
        
        loans.push({
          userId: member.id,
          institutionId: member.institutionId,
          loanType: helpers.pickRandom(['Personal', 'Business', 'Emergency', 'Education']),
          loanPurpose: helpers.pickRandom(['Business expansion', 'Medical expenses', 'Education fees', 'Home improvement', 'Debt consolidation']),
          loanAmount: loanAmount,
          interestRate: interestRate,
          duration: duration,
          monthlyPayment: monthlyPayment,
          totalRepayable: totalRepayable,
          outstandingBalance: outstandingBalance,
          status: status,
          approvedBy: ['approved', 'disbursed', 'repaying', 'completed', 'defaulted'].includes(status) ? approverId : null,
          disbursedAt: disbursedAt,
          nextPaymentDate: nextPaymentDate,
          completedAt: completedAt,
          paystackTransferRecipient: status !== 'pending' ? helpers.generatePaystackRecipientCode() : null,
          disbursementReference: status !== 'pending' ? helpers.generateDisbursementReference() : null,
          bankName: 'Wema Bank',
          accountNumber: helpers.generateNuban(),
          repaymentMode: helpers.pickRandom(['manual', 'automated']),
          monthlyDeductionAmount: monthlyPayment,
          dueDate: dueDate,
          originalDueDate: originalDueDate,
          lastDeductionDate: status === 'repaying' || status === 'completed' ? helpers.getOffsetDate(-helpers.randomAmount(1, 30)) : null,
          failedDeductionCount: failedDeductionCount,
          extensionCount: 0,
          remarks: status === 'rejected' ? 'Insufficient collateral' : (status === 'defaulted' ? 'Multiple failed deductions' : null),
          createdAt: now,
          updatedAt: now
        });
        
        // Create repayments for repaying and completed loans
        if (['repaying', 'completed'].includes(status)) {
          const monthsPaid = status === 'completed' ? duration : Math.floor((totalRepayable - outstandingBalance) / monthlyPayment);
          
          for (let i = 0; i < monthsPaid; i++) {
            const paidAt = new Date(disbursedAt);
            paidAt.setMonth(paidAt.getMonth() + i + 1);
            
            if (paidAt <= now) {
              repayments.push({
                loanId: loanId,
                transactionId: null, // Will be set later or left null for seeding
                amount: monthlyPayment,
                principal: loanAmount / duration,
                interest: (loanAmount * (interestRate / 100)) / duration,
                paidAt: paidAt,
                institutionId: member.institutionId,
                createdAt: now,
                updatedAt: now
              });
            }
          }
        }
      });
      
      // Insert loans first
      await queryInterface.bulkInsert('Loans', loans, { transaction });
      
      // Get the actual loan IDs inserted (they may differ from our sequential IDs)
      const [insertedLoans] = await queryInterface.sequelize.query(
        'SELECT id FROM Loans ORDER BY id',
        { transaction }
      );
      
      // Map sequential IDs to actual DB IDs for repayments
      const loanIdMap = {};
      insertedLoans.forEach((loan, index) => {
        loanIdMap[index + 1] = loan.id;
      });
      
      // Update repayment loanIds to match actual inserted IDs
      repayments.forEach(repayment => {
        repayment.loanId = loanIdMap[repayment.loanId] || repayment.loanId;
      });
      
      // Insert repayments
      if (repayments.length > 0) {
        await queryInterface.bulkInsert('LoanRepayments', repayments, { transaction });
      }
      
      await transaction.commit();
      console.log(`✅ Created ${loans.length} loans`);
      console.log(`   - ${loans.filter(l => l.status === 'pending').length} Pending`);
      console.log(`   - ${loans.filter(l => l.status === 'approved').length} Approved`);
      console.log(`   - ${loans.filter(l => l.status === 'disbursed').length} Disbursed`);
      console.log(`   - ${loans.filter(l => l.status === 'repaying').length} Repaying`);
      console.log(`   - ${loans.filter(l => l.status === 'completed').length} Completed`);
      console.log(`   - ${loans.filter(l => l.status === 'defaulted').length} Defaulted`);
      console.log(`✅ Created ${repayments.length} loan repayments`);
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error seeding loans:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('🗑️  Removing seeded loans and repayments...');
    await queryInterface.bulkDelete('LoanRepayments', null, {});
    await queryInterface.bulkDelete('Loans', null, {});
  }
};
