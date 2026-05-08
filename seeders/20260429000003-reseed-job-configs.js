'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('⏰ Seeding Job Configurations...');
      
      // Clear existing job configs
      await queryInterface.bulkDelete('JobConfigs', null, { transaction });
      
      const now = new Date();
      
      // Get institution IDs
      const [institutions] = await queryInterface.sequelize.query(
        'SELECT id, code FROM Institutions WHERE code IN ("COOP001", "UTS002", "MCU003")',
        { transaction }
      );
      
      const institutionMap = {};
      institutions.forEach(inst => {
        institutionMap[inst.code] = inst.id;
      });
      
      // Default jobs for each institution
      const jobTemplates = [
        {
          jobId: 'interest-calculation',
          name: 'Daily Interest Calculation',
          description: 'Calculate and credit daily interest to savings accounts',
          cronExpression: '0 1 * * *', // 1 AM daily
          isEnabled: true,
          isSystem: true,
          category: 'finance'
        },
        {
          jobId: 'thrift-deduction',
          name: 'Monthly Thrift Deduction',
          description: 'Automatically deduct monthly thrift contributions from member accounts',
          cronExpression: '0 0 27 * *', // 12 AM on 27th of each month
          isEnabled: true,
          isSystem: true,
          category: 'finance'
        },
        {
          jobId: 'loan-repayment',
          name: 'Automated Loan Repayment',
          description: 'Process automated loan repayments for due loans',
          cronExpression: '0 2 * * *', // 2 AM daily
          isEnabled: true,
          isSystem: true,
          category: 'finance'
        },
        {
          jobId: 'autosaver',
          name: 'Auto-Save Processing',
          description: 'Process recurring deposits for target savings plans',
          cronExpression: '0 3 * * *', // 3 AM daily
          isEnabled: true,
          isSystem: true,
          category: 'finance'
        },
        {
          jobId: 'notification-cleanup',
          name: 'Old Notification Cleanup',
          description: 'Archive and cleanup old read notifications',
          cronExpression: '0 4 * * 0', // 4 AM Sundays
          isEnabled: true,
          isSystem: true,
          category: 'maintenance'
        },
        {
          jobId: 'audit-log-archive',
          name: 'Audit Log Archiving',
          description: 'Archive old audit logs to external storage',
          cronExpression: '0 5 1 * *', // 5 AM on 1st of each month
          isEnabled: true,
          isSystem: true,
          category: 'maintenance'
        }
      ];
      
      const jobConfigs = [];
      
      // Create jobs for each institution
      Object.keys(institutionMap).forEach(code => {
        const institutionId = institutionMap[code];
        jobTemplates.forEach(template => {
          jobConfigs.push({
            ...template,
            jobId: `${template.jobId}-${code.toLowerCase()}`,
            institutionId: institutionId,
            lastRunAt: null,
            lastRunStatus: null,
            performedBy: null,
            createdAt: now,
            updatedAt: now
          });
        });
      });
      
      await queryInterface.bulkInsert('JobConfigs', jobConfigs, { transaction });
      
      await transaction.commit();
      console.log(`✅ Created ${jobConfigs.length} job configurations (${jobTemplates.length} per institution)`);
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error seeding job configurations:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('🗑️  Removing seeded job configurations...');
    await queryInterface.bulkDelete('JobConfigs', null, {});
  }
};
