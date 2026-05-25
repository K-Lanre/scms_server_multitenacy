'use strict';

const helpers = require('./utils/seederHelpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('💰 Seeding Accounts...');
      
      // Clear existing accounts
      await queryInterface.bulkDelete('Accounts', null, { transaction });
      
      const now = new Date();
      
      // Get all members (role = 'member') with their institution
      const [users] = await queryInterface.sequelize.query(
        `SELECT id, "institutionId", email, role FROM "Users" WHERE role = 'member' ORDER BY id`,
        { transaction }
      );
      
      // Get savings products for creating savings plan accounts
      const [savingsProducts] = await queryInterface.sequelize.query(
        `SELECT id, "institutionId", type FROM "SavingsProducts" WHERE type IN ('target', 'safebox')`,
        { transaction }
      );
      
      const accounts = [];
      let savingsPlanCount = 0;
      
      users.forEach(user => {
        if (!user.institutionId) return; // Skip users without institution
        
        // 1. General Savings Account (safebox type)
        const savingsBalance = helpers.randomAmount(10000, 500000);
        accounts.push({
          userId: user.id,
          institutionId: user.institutionId,
          accountNumber: helpers.generateAccountNumber('SAV'),
          accountType: 'savings',
          balance: savingsBalance,
          status: 'active',
          openedAt: helpers.getOffsetDate(-helpers.randomAmount(30, 365)),
          closedAt: null,
          paystackChannel: 'dedicated_account',
          paystackDedicatedAccountNumber: helpers.generateNuban(),
          paystackDedicatedAccountBank: helpers.getRandomBank(),
          paystackDedicatedAccountName: user.email.split('@')[0],
          paystackAssignmentReference: helpers.generateTransferReference(),
          createdAt: now,
          updatedAt: now
        });
        
        // 2. Share Capital Account (fixed type)
        const shareBalance = helpers.randomAmount(5000, 100000);
        accounts.push({
          userId: user.id,
          institutionId: user.institutionId,
          accountNumber: helpers.generateAccountNumber('SHR'),
          accountType: 'share_capital',
          balance: shareBalance,
          status: 'active',
          openedAt: helpers.getOffsetDate(-helpers.randomAmount(60, 730)),
          closedAt: null,
          paystackChannel: null,
          paystackDedicatedAccountNumber: null,
          paystackDedicatedAccountBank: null,
          paystackDedicatedAccountName: null,
          paystackAssignmentReference: null,
          createdAt: now,
          updatedAt: now
        });
        
        // 3. Savings Plan Accounts (30% of users have target/safebox plans)
        if (Math.random() < 0.3) {
          // Find a savings product for this user's institution
          const availableProducts = savingsProducts.filter(p => p.institutionId === user.institutionId);
          if (availableProducts.length > 0) {
            const product = helpers.pickRandom(availableProducts);
            const planBalance = helpers.randomAmount(5000, 150000);
            
            accounts.push({
              userId: user.id,
              institutionId: user.institutionId,
              accountNumber: helpers.generateAccountNumber('TRG'),
              accountType: 'savings_plan',
              balance: planBalance,
              status: 'active',
              openedAt: helpers.getOffsetDate(-helpers.randomAmount(30, 180)),
              closedAt: null,
              paystackChannel: null,
              paystackDedicatedAccountNumber: null,
              paystackDedicatedAccountBank: null,
              paystackDedicatedAccountName: null,
              paystackAssignmentReference: null,
              createdAt: now,
              updatedAt: now
            });
            savingsPlanCount++;
          }
        }
      });
      
      await queryInterface.bulkInsert('Accounts', accounts, { transaction });
      
      await transaction.commit();
      console.log(`✅ Created ${accounts.length} accounts`);
      console.log(`   - ${users.length} Savings accounts`);
      console.log(`   - ${users.length} Share Capital accounts`);
      console.log(`   - ${savingsPlanCount} Savings Plan accounts`);
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error seeding accounts:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('🗑️  Removing seeded accounts...');
    await queryInterface.bulkDelete('Accounts', null, {});
  }
};

