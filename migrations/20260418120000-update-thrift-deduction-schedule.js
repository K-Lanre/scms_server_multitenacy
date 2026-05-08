'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Update thrift-deductions job schedule from 27th to 19th
    await queryInterface.sequelize.query(`
      UPDATE JobConfigs 
      SET cronExpression = '0 1 19 * *', 
          updatedAt = NOW() 
      WHERE jobId = 'thrift-deductions'
    `);
  },

  async down(queryInterface, Sequelize) {
    // Revert back to 27th
    await queryInterface.sequelize.query(`
      UPDATE JobConfigs 
      SET cronExpression = '0 1 27 * *', 
          updatedAt = NOW() 
      WHERE jobId = 'thrift-deductions'
    `);
  }
};
