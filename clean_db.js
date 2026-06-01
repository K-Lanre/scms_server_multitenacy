const path = require('path');
const { sequelize } = require(path.join(__dirname, 'config', 'database'));

(async () => {
  try {
    console.log('🧹 Dropping public schema...');
    await sequelize.query('DROP SCHEMA public CASCADE;');
    console.log('🏗️ Recreating public schema...');
    await sequelize.query('CREATE SCHEMA public;');
    await sequelize.query('GRANT ALL ON SCHEMA public TO postgres;');
    await sequelize.query('GRANT ALL ON SCHEMA public TO public;');
    console.log('✨ Database clean successful!');
  } catch (err) {
    console.error('❌ Error cleaning database:', err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
})();
