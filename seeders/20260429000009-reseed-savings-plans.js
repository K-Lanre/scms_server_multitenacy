'use strict';

const helpers = require('./utils/seederHelpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🎯 Seeding User Savings Plans...');
      
      // Clear existing savings plans
      await queryInterface.bulkDelete('UserSavingsPlans', null, { transaction });
      
      const now = new Date();
      const savingsPlans = [];
      
      // Get savings plan accounts with their users
      const [planAccounts] = await queryInterface.sequelize.query(
        `SELECT a.id as accountId, a.userId, a.institutionId, a.balance, 
                u.email, u.name
         FROM Accounts a
         JOIN Users u ON a.userId = u.id
         WHERE a.accountType = 'savings_plan'
         ORDER BY a.id`,
        { transaction }
      );
      
      // Get savings products for each institution
      const [savingsProducts] = await queryInterface.sequelize.query(
        `SELECT id, institutionId, type, name FROM SavingsProducts WHERE type IN ('target', 'safebox')`,
        { transaction }
      );
      
      // Group products by institution
      const productsByInstitution = {};
      savingsProducts.forEach(product => {
        if (!productsByInstitution[product.institutionId]) {
          productsByInstitution[product.institutionId] = [];
        }
        productsByInstitution[product.institutionId].push(product);
      });
      
      planAccounts.forEach(account => {
        const institutionProducts = productsByInstitution[account.institutionId] || [];
        if (institutionProducts.length === 0) return;
        
        const product = helpers.pickRandom(institutionProducts);
        const currentBalance = parseFloat(account.balance);
        
        // Generate realistic target amount
        const targetAmount = Math.max(currentBalance * 2, helpers.randomAmount(50000, 500000));
        const duration = helpers.randomAmount(30, 365); // 30 days to 1 year
        
        // Determine status
        const statuses = ['active', 'completed', 'defaulted', 'liquidated'];
        let status = 'active';
        
        if (currentBalance >= targetAmount) {
          status = 'completed';
        } else if (Math.random() < 0.1) {
          status = helpers.pickRandom(['defaulted', 'liquidated']);
        }
        
        const startDate = helpers.getOffsetDate(-helpers.randomAmount(30, 180));
        const maturityDate = new Date(startDate);
        maturityDate.setDate(maturityDate.getDate() + duration);
        
        savingsPlans.push({
          userId: account.userId,
          productId: product.id,
          accountId: account.accountId,
          planName: helpers.pickRandom([
            'Holiday Fund', 'School Fees', 'New Car', 'House Rent', 
            'Business Capital', 'Emergency Fund', 'Wedding Savings', 'Travel Fund'
          ]),
          targetAmount: targetAmount,
          duration: duration,
          startDate: startDate,
          maturityDate: maturityDate,
          autoSaveAmount: helpers.randomAmount(1000, 10000),
          frequency: helpers.pickRandom(['daily', 'weekly', 'monthly', 'manual']),
          status: status,
          lastInterestDate: status === 'active' ? helpers.getOffsetDate(-helpers.randomAmount(1, 30)) : null,
          lastAutoSaveDate: status === 'active' ? helpers.getOffsetDate(-helpers.randomAmount(1, 7)) : null,
          withdrawalRequestedAt: null,
          institutionId: account.institutionId,
          createdAt: now,
          updatedAt: now
        });
      });
      
      await queryInterface.bulkInsert('UserSavingsPlans', savingsPlans, { transaction });
      
      await transaction.commit();
      console.log(`✅ Created ${savingsPlans.length} user savings plans`);
      console.log(`   - ${savingsPlans.filter(p => p.status === 'active').length} Active`);
      console.log(`   - ${savingsPlans.filter(p => p.status === 'completed').length} Completed`);
      console.log(`   - ${savingsPlans.filter(p => p.status === 'defaulted').length} Defaulted`);
      console.log(`   - ${savingsPlans.filter(p => p.status === 'liquidated').length} Liquidated`);
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error seeding user savings plans:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('🗑️  Removing seeded user savings plans...');
    await queryInterface.bulkDelete('UserSavingsPlans', null, {});
  }
};
