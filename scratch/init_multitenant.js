const { Institution, User, sequelize } = require('../models');

async function addColumnIfNotExists(tableName, columnName, columnDefinition) {
    const queryInterface = sequelize.getQueryInterface();
    const tableDesc = await queryInterface.describeTable(tableName);
    if (!tableDesc[columnName]) {
        console.log(`Adding ${columnName} to ${tableName}...`);
        await sequelize.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
    } else {
        console.log(`Column ${columnName} already exists in ${tableName}.`);
    }
}

async function init() {
  try {
    console.log('Manually checking and adding institutionId columns...');
    
    // Create Institutions table if it doesn't exist
    await Institution.sync(); 
    
    // Manually add institutionId to tables to avoid Sequelize ER_TOO_MANY_KEYS bug during alter: true
    await addColumnIfNotExists('Users', 'institutionId', 'INTEGER NULL');
    await addColumnIfNotExists('Accounts', 'institutionId', 'INTEGER NULL');
    await addColumnIfNotExists('Loans', 'institutionId', 'INTEGER NULL');
    await addColumnIfNotExists('Transactions', 'institutionId', 'INTEGER NULL');
    await addColumnIfNotExists('SavingsProducts', 'institutionId', 'INTEGER NULL');
    await addColumnIfNotExists('Contributions', 'institutionId', 'INTEGER NULL');
    await addColumnIfNotExists('Meetings', 'institutionId', 'INTEGER NULL');

    console.log('Columns added. Proceeding to seed default institution...');

    // 1. Create default institution
    const [inst, created] = await Institution.findOrCreate({
      where: { code: 'COOP001' },
      defaults: {
        name: 'First Cooperative Society',
        email: 'admin@coop001.com',
        phone: '08000000000',
        address: '123 Cooperative Way, Lagos',
        status: 'active',
        settings: {
            currency: 'NGN',
            defaultInterestRate: 5,
            timezone: 'Africa/Lagos',
            thriftFrequency: 'monthly'
        }
      }
    });

    console.log(`Institution Created/Verified: COOP001 (ID: ${inst.id})`);
    
    // 2. Update existing records to this institution (for migration)
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.bulkUpdate('Users', { institutionId: inst.id }, { institutionId: null });
    await queryInterface.bulkUpdate('Accounts', { institutionId: inst.id }, { institutionId: null });
    await queryInterface.bulkUpdate('Loans', { institutionId: inst.id }, { institutionId: null });
    await queryInterface.bulkUpdate('Transactions', { institutionId: inst.id }, { institutionId: null });
    await queryInterface.bulkUpdate('SavingsProducts', { institutionId: inst.id }, { institutionId: null });
    await queryInterface.bulkUpdate('Contributions', { institutionId: inst.id }, { institutionId: null });
    await queryInterface.bulkUpdate('Meetings', { institutionId: inst.id }, { institutionId: null });

    console.log('All legacy records migrated to COOP001.');

    // 3. Make sure the first user is a super_admin if there's no super_admin
    const superAdmins = await User.count({ where: { role: 'super_admin' } });
    if (superAdmins === 0) {
      const firstAdmin = await User.findOne({ where: { role: 'admin' }, order: [['createdAt', 'ASC']] });
      if (firstAdmin) {
        firstAdmin.role = 'super_admin';
        await firstAdmin.save();
        console.log(`Upgraded admin ${firstAdmin.email} to super_admin.`);
      } else {
        const firstUser = await User.findOne({ order: [['createdAt', 'ASC']] });
        if (firstUser) {
           firstUser.role = 'super_admin';
           await firstUser.save();
           console.log(`Upgraded user ${firstUser.email} to super_admin.`);
        }
      }
    }

    console.log('Migration successful!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

init();
