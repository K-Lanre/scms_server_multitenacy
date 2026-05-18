const { sequelize } = require('../models');

async function simulateTenure(email) {
  if (!email) {
    console.error('Please provide an email address.');
    process.exit(1);
  }

  try {
    // Set createdAt to 4 months ago
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
    const dateStr = fourMonthsAgo.toISOString().slice(0, 19).replace('T', ' ');

    console.log(`Updating user ${email} to createdAt: ${dateStr}...`);

    // Using raw query to bypass Sequelize timestamp protection
    await sequelize.query(
      `UPDATE Users SET createdAt = :dateStr, updatedAt = NOW() WHERE email = :email`,
      {
        replacements: { dateStr, email },
        type: sequelize.QueryTypes.UPDATE
      }
    );

    console.log(`Success! User ${email} membership date updated.`);
    console.log('They can now apply for loans.');
    process.exit(0);
  } catch (err) {
    console.error('Error updating user:', err);
    process.exit(1);
  }
}

const email = process.argv[2];
simulateTenure(email);
