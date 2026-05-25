'use strict';

const helpers = require('./utils/seederHelpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('💸 Seeding Transactions...');
      
      // Clear existing transactions
      await queryInterface.bulkDelete('Transactions', null, { transaction });
      
      const now = new Date();
      const transactions = [];
      
// Get all accounts with their users
      const [accounts] = await queryInterface.sequelize.query(
        `SELECT a.id, a."userId", a."institutionId", a."accountType", a.balance, u.email 
         FROM "Accounts" a 
         JOIN "Users" u ON a."userId" = u.id 
         ORDER BY a.id`,
        { transaction }
      );
      
      // Get admin users for each institution to be 'performedBy'
      const [admins] = await queryInterface.sequelize.query(
        `SELECT id, "institutionId", role FROM "Users" 
         WHERE role IN ('super_admin', 'institution_admin', 'staff') 
         ORDER BY id`,
        { transaction }
      );
      
      // Group admins by institution
      const adminsByInstitution = {};
      admins.forEach(admin => {
        const key = admin.institutionId || 'global';
        if (!adminsByInstitution[key]) {
          adminsByInstitution[key] = [];
        }
        adminsByInstitution[key].push(admin);
      });
      
      // Helper to get a random admin for an institution
      function getPerformer(institutionId) {
        const institutionAdmins = adminsByInstitution[institutionId] || [];
        const globalAdmins = adminsByInstitution['global'] || [];
        const availableAdmins = institutionAdmins.length > 0 ? institutionAdmins : globalAdmins;
        return availableAdmins.length > 0 ? helpers.pickRandom(availableAdmins).id : 1;
      }
      
      // Create transactions for each account
      accounts.forEach(account => {
        const performerId = getPerformer(account.institutionId);
        
        // Initial deposit transaction (always exists for active accounts)
        let currentBalance = 0;
        
        // For savings accounts - initial deposit
        if (account.accountType === 'savings') {
          const initialDeposit = parseFloat(account.balance);
          if (initialDeposit > 0) {
            transactions.push({
              accountId: account.id,
              institutionId: account.institutionId,
              transactionType: 'deposit',
              amount: initialDeposit,
              balanceAfter: initialDeposit,
              reference: helpers.generateTransactionReference('DEP'),
              description: 'Initial savings deposit',
              performedBy: performerId,
              status: 'completed',
              completedAt: helpers.getOffsetDate(-helpers.randomAmount(30, 365)),
              linkedTransactionId: null,
              purpose: 'savings',
              createdAt: now,
              updatedAt: now
            });
            currentBalance = initialDeposit;
          }
          
          // Add 1-3 additional deposits for some accounts
          const additionalDeposits = helpers.randomAmount(0, 3);
          for (let i = 0; i < additionalDeposits; i++) {
            const depositAmount = helpers.randomAmount(5000, 50000);
            currentBalance += depositAmount;
            transactions.push({
              accountId: account.id,
              institutionId: account.institutionId,
              transactionType: 'deposit',
              amount: depositAmount,
              balanceAfter: currentBalance,
              reference: helpers.generateTransactionReference('DEP'),
              description: helpers.pickRandom(['Monthly contribution', 'Voluntary deposit', 'Quick save']),
              performedBy: performerId,
              status: 'completed',
              completedAt: helpers.getOffsetDate(-helpers.randomAmount(1, 60)),
              linkedTransactionId: null,
              purpose: helpers.pickRandom(['savings', 'contribution', 'other']),
              createdAt: now,
              updatedAt: now
            });
          }
          
          // Add some withdrawals (20% of accounts)
          if (Math.random() < 0.2 && currentBalance > 10000) {
            const withdrawalAmount = helpers.randomAmount(5000, Math.min(30000, currentBalance * 0.3));
            currentBalance -= withdrawalAmount;
            transactions.push({
              accountId: account.id,
              institutionId: account.institutionId,
              transactionType: 'withdrawal',
              amount: withdrawalAmount,
              balanceAfter: currentBalance,
              reference: helpers.generateTransactionReference('WDR'),
              description: 'Withdrawal request processed',
              performedBy: performerId,
              status: 'completed',
              completedAt: helpers.getOffsetDate(-helpers.randomAmount(1, 30)),
              linkedTransactionId: null,
              purpose: helpers.pickRandom(['family_support', 'business', 'other']),
              createdAt: now,
              updatedAt: now
            });
          }
        }
        
        // For share capital accounts - share purchase
        if (account.accountType === 'share_capital') {
          const shareAmount = parseFloat(account.balance);
          if (shareAmount > 0) {
            transactions.push({
              accountId: account.id,
              institutionId: account.institutionId,
              transactionType: 'share_purchase',
              amount: shareAmount,
              balanceAfter: shareAmount,
              reference: helpers.generateTransactionReference('SHR'),
              description: 'Initial share capital purchase',
              performedBy: performerId,
              status: 'completed',
              completedAt: helpers.getOffsetDate(-helpers.randomAmount(60, 730)),
              linkedTransactionId: null,
              purpose: 'contribution',
              createdAt: now,
              updatedAt: now
            });
            
            // Additional share purchases for some accounts
            if (Math.random() < 0.3) {
              const additionalShares = helpers.randomAmount(1000, 10000);
              const newBalance = shareAmount + additionalShares;
              transactions.push({
                accountId: account.id,
                institutionId: account.institutionId,
                transactionType: 'share_purchase',
                amount: additionalShares,
                balanceAfter: newBalance,
                reference: helpers.generateTransactionReference('SHR'),
                description: 'Additional share purchase',
                performedBy: performerId,
                status: 'completed',
                completedAt: helpers.getOffsetDate(-helpers.randomAmount(30, 180)),
                linkedTransactionId: null,
                purpose: 'contribution',
                createdAt: now,
                updatedAt: now
              });
            }
          }
        }
        
        // For savings plan accounts - deposits
        if (account.accountType === 'savings_plan') {
          const planAmount = parseFloat(account.balance);
          if (planAmount > 0) {
            transactions.push({
              accountId: account.id,
              institutionId: account.institutionId,
              transactionType: 'deposit',
              amount: planAmount,
              balanceAfter: planAmount,
              reference: helpers.generateTransactionReference('TRG'),
              description: 'Target savings deposit',
              performedBy: performerId,
              status: 'completed',
              completedAt: helpers.getOffsetDate(-helpers.randomAmount(7, 90)),
              linkedTransactionId: null,
              purpose: 'savings',
              createdAt: now,
              updatedAt: now
            });
          }
        }
        
        // Add interest credits for savings accounts (30% of accounts)
        if (account.accountType === 'savings' && Math.random() < 0.3 && currentBalance > 0) {
          const interestAmount = currentBalance * (helpers.randomAmount(1, 5) / 100);
          const newBalance = currentBalance + interestAmount;
          transactions.push({
            accountId: account.id,
            institutionId: account.institutionId,
            transactionType: 'interest',
            amount: interestAmount,
            balanceAfter: newBalance,
            reference: helpers.generateTransactionReference('INT'),
            description: 'Monthly interest credit',
            performedBy: performerId,
            status: 'completed',
            completedAt: helpers.getOffsetDate(-helpers.randomAmount(1, 30)),
            linkedTransactionId: null,
            purpose: 'savings',
            createdAt: now,
            updatedAt: now
          });
        }
      });
      
      await queryInterface.bulkInsert('Transactions', transactions, { transaction });
      
      await transaction.commit();
      console.log(`✅ Created ${transactions.length} transactions`);
      console.log('   - Initial deposits, share purchases, savings deposits');
      console.log('   - Additional deposits and some withdrawals');
      console.log('   - Interest credits for eligible accounts');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error seeding transactions:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('🗑️  Removing seeded transactions...');
    await queryInterface.bulkDelete('Transactions', null, {});
  }
};

