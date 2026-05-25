const path = require('path');
const { sequelize, Sequelize } = require(path.join(__dirname, 'config', 'database'));
(async () => {
  try {
    const users = await sequelize.query('SELECT id, email, "name", role, status FROM "Users" ORDER BY id;', {
      type: Sequelize.QueryTypes.SELECT,
    });
    console.log(JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('❌ Error querying users:', err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
})();
