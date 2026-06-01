'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🏦 Seeding Savings Products...');

      // Clear existing savings products
      await queryInterface.bulkDelete('SavingsProducts', null, { transaction });

      const now = new Date();

      // Get institution IDs
      const [institutions] = await queryInterface.sequelize.query(
        `SELECT id, code FROM "Institutions" WHERE code IN ('COOP001', 'UTS002', 'MCU003')`,
        { transaction }
      );

      const institutionMap = {};
      institutions.forEach(inst => {
        institutionMap[inst.code] = inst.id;
      });

      // Product templates per institution
      const productsByInstitution = {
        COOP001: [
          {
            name: 'General Savings',
            description: 'Mandatory cooperative savings account with competitive interest',
            type: 'safebox',
            category: 'none',
            interestRate: 5.5,
            minDeposit: 1000,
            minDuration: 30,
            penaltyPercentage: 2.0,
            allowEarlyWithdrawal: true,
            isQuickSaving: false,
            status: 'active'
          },
          {
            name: 'Share Capital',
            description: 'Mandatory shareholding account for dividend eligibility',
            type: 'fixed',
            category: 'none',
            interestRate: 0,
            minDeposit: 5000,
            minDuration: 365,
            penaltyPercentage: 0,
            allowEarlyWithdrawal: false,
            isQuickSaving: false,
            status: 'active'
          },
          {
            name: 'Eid Festival Target',
            description: 'Save strictly towards Eid celebrations with bonus interest',
            type: 'target',
            category: 'festive',
            interestRate: 6.5,
            minDeposit: 2000,
            minDuration: 60,
            maxDuration: 365,
            penaltyPercentage: 5.0,
            allowEarlyWithdrawal: true,
            isQuickSaving: false,
            status: 'active'
          },
          {
            name: 'Education Fund',
            description: 'Target savings for school fees and educational expenses',
            type: 'target',
            category: 'education',
            interestRate: 6.0,
            minDeposit: 5000,
            minDuration: 90,
            maxDuration: 730,
            penaltyPercentage: 3.0,
            allowEarlyWithdrawal: true,
            isQuickSaving: false,
            status: 'active'
          }
        ],
        UTS002: [
          {
            name: 'Premium Savings',
            description: 'High-yield savings for serious savers',
            type: 'safebox',
            category: 'none',
            interestRate: 7.0,
            minDeposit: 10000,
            minDuration: 30,
            penaltyPercentage: 1.5,
            allowEarlyWithdrawal: true,
            isQuickSaving: false,
            status: 'active'
          },
          {
            name: 'Share Capital',
            description: 'Mandatory shareholding account for dividend eligibility',
            type: 'fixed',
            category: 'none',
            interestRate: 0,
            minDeposit: 10000,
            minDuration: 365,
            penaltyPercentage: 0,
            allowEarlyWithdrawal: false,
            isQuickSaving: false,
            status: 'active'
          },
          {
            name: 'Business SafeBox',
            description: 'Quick access savings for business opportunities',
            type: 'safebox',
            category: 'business',
            interestRate: 5.0,
            minDeposit: 5000,
            minDuration: 7,
            penaltyPercentage: 1.0,
            allowEarlyWithdrawal: true,
            isQuickSaving: true,
            status: 'active'
          },
          {
            name: 'Education Target',
            description: 'Save for children education with extended duration',
            type: 'target',
            category: 'education',
            interestRate: 7.5,
            minDeposit: 5000,
            minDuration: 180,
            maxDuration: 1095,
            penaltyPercentage: 2.5,
            allowEarlyWithdrawal: true,
            isQuickSaving: false,
            status: 'active'
          }
        ],
        MCU003: [
          {
            name: 'Basic Savings',
            description: 'Entry-level savings account for all members',
            type: 'safebox',
            category: 'none',
            interestRate: 4.0,
            minDeposit: 500,
            minDuration: 30,
            penaltyPercentage: 2.5,
            allowEarlyWithdrawal: true,
            isQuickSaving: false,
            status: 'active'
          },
          {
            name: 'Share Capital',
            description: 'Mandatory shareholding account for dividend eligibility',
            type: 'fixed',
            category: 'none',
            interestRate: 0,
            minDeposit: 3000,
            minDuration: 365,
            penaltyPercentage: 0,
            allowEarlyWithdrawal: false,
            isQuickSaving: false,
            status: 'active'
          },
          {
            name: 'Emergency Fund',
            description: 'Quick access savings for emergencies and unexpected expenses',
            type: 'safebox',
            category: 'emergency',
            interestRate: 3.5,
            minDeposit: 1000,
            minDuration: 1,
            penaltyPercentage: 0.5,
            allowEarlyWithdrawal: true,
            isQuickSaving: true,
            status: 'active'
          },
          {
            name: 'Rent Target',
            description: 'Save towards annual rent payments',
            type: 'target',
            category: 'rent',
            interestRate: 5.0,
            minDeposit: 5000,
            minDuration: 180,
            maxDuration: 365,
            penaltyPercentage: 2.0,
            allowEarlyWithdrawal: true,
            isQuickSaving: false,
            status: 'active'
          }
        ]
      };

      const allProducts = [];

      Object.keys(institutionMap).forEach(code => {
        const institutionId = institutionMap[code];
        const products = productsByInstitution[code] || [];

        products.forEach(product => {
          allProducts.push({
            ...product,
            institutionId: institutionId,
            maxDuration: product.maxDuration || null,
            createdAt: now,
            updatedAt: now
          });
        });
      });

      await queryInterface.bulkInsert('SavingsProducts', allProducts, { transaction });

      await transaction.commit();
      console.log(`✅ Created ${allProducts.length} savings products (${allProducts.length / 3} per institution)`);

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error seeding savings products:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('🗑️  Removing seeded savings products...');
    await queryInterface.bulkDelete('SavingsProducts', null, {});
  }
};

