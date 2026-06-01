'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🏛️  Seeding Institutions...');

      const dependentTables = [
        'AuditLogs',
        'Notifications',
        'WithdrawalRequests',
        'MeetingMinutes',
        'Meetings',
        'Contributions',
        'LoanRepayments',
        'LoanGuarantors',
        'Loans',
        'UserSavingsPlans',
        'Transactions',
        'Accounts',
        'PostingLogs',
        'DividendRuns',
        'Levies',
        'WelfareApplications',
        'Donations',
        'DonationRequests'
      ];

      const existingTables = await queryInterface.showAllTables({ transaction });
      const existingTableNames = existingTables.map((table) => (
        typeof table === 'string' ? table : table.tableName
      ));
      const tablesToTruncate = dependentTables.filter((table) => existingTableNames.includes(table));

      if (tablesToTruncate.length > 0) {
        const quotedTables = tablesToTruncate
          .map((table) => queryInterface.queryGenerator.quoteTable(table))
          .join(', ');

        await queryInterface.sequelize.query(
          `TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`,
          { transaction }
        );
      }
      
      // Clear existing institutions first
      await queryInterface.bulkDelete('Institutions', null, { transaction });
      
      const now = new Date();
      
      const institutions = [
        {
          name: 'First Cooperative Society',
          code: 'COOP001',
          email: 'admin@coop001.com',
          phone: '08000000001',
          address: '123 Cooperative Way, Lagos',
          status: 'active',
          settings: JSON.stringify({
            currency: 'NGN',
            defaultInterestRate: 5.5,
            timezone: 'Africa/Lagos',
            thriftFrequency: 'monthly',
            monthlyThriftAmount: 10000,
            lateThriftPenalty: 500,
            deductionDay: 27,
            medicalWelfareCap: 50000,
            funeralWelfareCap: 100000,
            allowLoanApplications: true,
            allowWithdrawals: true
          }),
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Unity Thrift Society',
          code: 'UTS002',
          email: 'admin@uts002.com',
          phone: '08000000002',
          address: '456 Unity Street, Ikeja',
          status: 'active',
          settings: JSON.stringify({
            currency: 'NGN',
            defaultInterestRate: 7.0,
            timezone: 'Africa/Lagos',
            thriftFrequency: 'monthly',
            monthlyThriftAmount: 20000,
            lateThriftPenalty: 1000,
            deductionDay: 25,
            medicalWelfareCap: 75000,
            funeralWelfareCap: 150000,
            allowLoanApplications: true,
            allowWithdrawals: true
          }),
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Metro Credit Union',
          code: 'MCU003',
          email: 'admin@mcu003.com',
          phone: '08000000003',
          address: '789 Metro Avenue, Abuja',
          status: 'active',
          settings: JSON.stringify({
            currency: 'NGN',
            defaultInterestRate: 4.0,
            timezone: 'Africa/Lagos',
            thriftFrequency: 'monthly',
            monthlyThriftAmount: 5000,
            lateThriftPenalty: 250,
            deductionDay: 28,
            medicalWelfareCap: 30000,
            funeralWelfareCap: 80000,
            allowLoanApplications: true,
            allowWithdrawals: true
          }),
          createdAt: now,
          updatedAt: now
        }
      ];
      
      await queryInterface.bulkInsert('Institutions', institutions, { transaction });
      
      await transaction.commit();
      console.log('✅ Created 3 institutions: COOP001, UTS002, MCU003');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error seeding institutions:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('🗑️  Removing seeded institutions...');
    await queryInterface.bulkDelete('Institutions', null, {});
  }
};

