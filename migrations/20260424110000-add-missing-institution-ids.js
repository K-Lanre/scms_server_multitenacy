'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Helper to add column safely
    const addColumnSafely = async (tableName, columnName, options) => {
      const tableDesc = await queryInterface.describeTable(tableName);
      if (!tableDesc[columnName]) {
        await queryInterface.addColumn(tableName, columnName, options);
      }
    };

    const columnOptions = {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'Institutions',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    };

    // Add institutionId to missing tables
    await addColumnSafely('WithdrawalRequests', 'institutionId', columnOptions);
    await addColumnSafely('UserSavingsPlans', 'institutionId', columnOptions);
    await addColumnSafely('Notifications', 'institutionId', columnOptions);
    await addColumnSafely('JobConfigs', 'institutionId', columnOptions);
    await addColumnSafely('LoanRepayments', 'institutionId', columnOptions);
    await addColumnSafely('SystemSettings', 'institutionId', columnOptions);

    // Backfill: Many existing records might already belong to the first institution (COOP001)
    // We can handle this in a separate seed or logic, but for now we keep them NULL or set to 1
    // if institution 1 exists.

    const [institutions] = await queryInterface.sequelize.query('SELECT id FROM "Institutions" LIMIT 1;');
    if (institutions.length > 0) {
      const firstId = institutions[0].id;
      const tables = ['WithdrawalRequests', 'UserSavingsPlans', 'Notifications', 'JobConfigs', 'LoanRepayments', 'SystemSettings'];
      for (const table of tables) {
        await queryInterface.sequelize.query(`UPDATE "${table}" SET "institutionId" = ${firstId} WHERE "institutionId" IS NULL;`);
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tables = ['WithdrawalRequests', 'UserSavingsPlans', 'Notifications', 'JobConfigs', 'LoanRepayments', 'SystemSettings'];
    for (const table of tables) {
      const tableDesc = await queryInterface.describeTable(table);
      if (tableDesc['institutionId']) {
        await queryInterface.removeColumn(table, 'institutionId');
      }
    }
  }
};
