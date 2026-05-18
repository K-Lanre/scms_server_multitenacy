'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Get the treasury user and account
    const user = await queryInterface.sequelize.query(
      `SELECT id FROM Users WHERE email = 'treasury@coop.system' LIMIT 1`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (user && user[0]) {
      const treasuryUserId = user[0].id;

      const account = await queryInterface.sequelize.query(
        `SELECT id FROM Accounts WHERE userId = ${treasuryUserId} AND accountType = 'savings' LIMIT 1`,
        { type: Sequelize.QueryTypes.SELECT }
      );

      if (account && account[0]) {
        const treasuryId = account[0].id;

        // Add seed capital of ₦5,000,000
        await queryInterface.sequelize.query(`
          UPDATE Accounts 
          SET balance = 5000000,
              updatedAt = NOW()
          WHERE id = ${treasuryId}
        `);

        // Create a transaction record for this seed capital
        await queryInterface.sequelize.query(`
          INSERT INTO Transactions 
          (accountId, transactionType, amount, balanceAfter, reference, description, status, completedAt, performedBy, createdAt, updatedAt)
          VALUES 
          (${treasuryId}, 'deposit', 5000000, 5000000, 'SEED-CAPITAL-001', 'Initial seed capital for cooperative treasury', 'completed', NOW(), ${treasuryUserId}, NOW(), NOW())
        `);
      }
    }
  },

  async down(queryInterface, Sequelize) {
    // Get the treasury account by joining with Users table
    const account = await queryInterface.sequelize.query(
      `SELECT a.id FROM Accounts a 
       JOIN Users u ON a.userId = u.id 
       WHERE u.email = 'treasury@coop.system' 
       LIMIT 1`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (account && account[0]) {
      const treasuryId = account[0].id;

      // Remove seed capital (set back to 0)
      await queryInterface.sequelize.query(`
        UPDATE Accounts 
        SET balance = 0,
            updatedAt = NOW()
        WHERE id = ${treasuryId}
      `);
    }

    // Remove the transaction record
    await queryInterface.sequelize.query(`
      DELETE FROM Transactions 
      WHERE reference = 'SEED-CAPITAL-001'
    `);
  }
};
