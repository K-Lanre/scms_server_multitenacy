'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('⚙️  Seeding System Settings...');

      // Clear existing settings
      await queryInterface.bulkDelete('SystemSettings', null, { transaction });

      const now = new Date();

      // Get institution IDs (they should be 1, 2, 3 based on insertion order)
      const [institutions] = await queryInterface.sequelize.query(
        'SELECT id, code FROM "Institutions" WHERE code IN (\'COOP001\', \'UTS002\', \'MCU003\')',
        { transaction }
      );

      const institutionMap = {};
      institutions.forEach(inst => {
        institutionMap[inst.code] = inst.id;
      });

      // Global settings (no institutionId)
      const globalSettings = [
        {
          key: 'systemVersion',
          value: '1.0.0',
          type: 'string',
          description: 'Current system version',
          institutionId: null,
          createdAt: now,
          updatedAt: now
        },
        {
          key: 'maintenanceMode',
          value: 'false',
          type: 'boolean',
          description: 'System maintenance mode flag',
          institutionId: null,
          createdAt: now,
          updatedAt: now
        },
        {
          key: 'defaultGuarantorThreshold',
          value: '3',
          type: 'number',
          description: 'Default number of guarantors required for loans',
          institutionId: null,
          createdAt: now,
          updatedAt: now
        }
      ];

      // Per-institution settings
      const institutionSettings = [];

      // COOP001 settings
      if (institutionMap.COOP001) {
        institutionSettings.push(
          {
            key: 'monthlyThriftAmount',
            value: '10000',
            type: 'number',
            description: 'Default monthly thrift contribution',
            institutionId: institutionMap.COOP001,
            createdAt: now,
            updatedAt: now
          },
          {
            key: 'lateThriftPenalty',
            value: '500',
            type: 'number',
            description: 'Penalty for late thrift payment',
            institutionId: institutionMap.COOP001,
            createdAt: now,
            updatedAt: now
          },
          {
            key: 'loan_interest_tiers',
            value: JSON.stringify([
              { minMonths: 1, maxMonths: 3, rate: 5, label: 'Emergency' },
              { minMonths: 4, maxMonths: 12, rate: 3, label: 'Standard' },
              { minMonths: 13, maxMonths: 60, rate: 2, label: 'Project' }
            ]),
            type: 'json',
            description: 'Monthly interest rates based on loan duration (Tenure Tiers)',
            institutionId: institutionMap.COOP001,
            createdAt: now,
            updatedAt: now
          }
        );
      }

      // UTS002 settings
      if (institutionMap.UTS002) {
        institutionSettings.push(
          {
            key: 'monthlyThriftAmount',
            value: '20000',
            type: 'number',
            description: 'Default monthly thrift contribution',
            institutionId: institutionMap.UTS002,
            createdAt: now,
            updatedAt: now
          },
          {
            key: 'lateThriftPenalty',
            value: '1000',
            type: 'number',
            description: 'Penalty for late thrift payment',
            institutionId: institutionMap.UTS002,
            createdAt: now,
            updatedAt: now
          },
          {
            key: 'loan_interest_tiers',
            value: JSON.stringify([
              { minMonths: 1, maxMonths: 3, rate: 4, label: 'Emergency' },
              { minMonths: 4, maxMonths: 12, rate: 2.5, label: 'Standard' },
              { minMonths: 13, maxMonths: 60, rate: 1.5, label: 'Project' }
            ]),
            type: 'json',
            description: 'Monthly interest rates based on loan duration (Tenure Tiers)',
            institutionId: institutionMap.UTS002,
            createdAt: now,
            updatedAt: now
          }
        );
      }

      // MCU003 settings
      if (institutionMap.MCU003) {
        institutionSettings.push(
          {
            key: 'monthlyThriftAmount',
            value: '5000',
            type: 'number',
            description: 'Default monthly thrift contribution',
            institutionId: institutionMap.MCU003,
            createdAt: now,
            updatedAt: now
          },
          {
            key: 'lateThriftPenalty',
            value: '250',
            type: 'number',
            description: 'Penalty for late thrift payment',
            institutionId: institutionMap.MCU003,
            createdAt: now,
            updatedAt: now
          },
          {
            key: 'loan_interest_tiers',
            value: JSON.stringify([
              { minMonths: 1, maxMonths: 3, rate: 6, label: 'Emergency' },
              { minMonths: 4, maxMonths: 12, rate: 4, label: 'Standard' },
              { minMonths: 13, maxMonths: 60, rate: 3, label: 'Project' }
            ]),
            type: 'json',
            description: 'Monthly interest rates based on loan duration (Tenure Tiers)',
            institutionId: institutionMap.MCU003,
            createdAt: now,
            updatedAt: now
          }
        );
      }

      const allSettings = [...globalSettings, ...institutionSettings];
      await queryInterface.bulkInsert('SystemSettings', allSettings, { transaction });

      await transaction.commit();
      console.log(`✅ Created ${allSettings.length} system settings`);

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error seeding system settings:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('🗑️  Removing seeded system settings...');
    await queryInterface.bulkDelete('SystemSettings', null, {});
  }
};

