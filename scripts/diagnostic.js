const { User, Account, Institution } = require('../models');

async function diagnostic() {
    try {
        console.log('--- Database Diagnostic ---');
        
        // 1. Check Institutions
        const institutions = await Institution.findAll({ attributes: ['id', 'name', 'code'] });
        console.log('Institutions found:', institutions.map(i => `${i.name} (ID: ${i.id}, Code: ${i.code})`));

        // 2. Check all Users and their institutionId
        const userCounts = await User.count();
        const usersWithInst = await User.count({ where: { institutionId: { [require('sequelize').Op.not]: null } } });
        console.log(`Total Users: ${userCounts}`);
        console.log(`Users linked to an institution: ${usersWithInst}`);

        // 3. Check all Accounts and their institutionId
        const accountCounts = await Account.count();
        const accountsWithInst = await Account.count({ where: { institutionId: { [require('sequelize').Op.not]: null } } });
        const totalBalance = await Account.sum('balance') || 0;
        console.log(`Total Accounts: ${accountCounts}`);
        console.log(`Accounts linked to an institution: ${accountsWithInst}`);
        console.log(`Total System-wide Balance: ₦${parseFloat(totalBalance).toLocaleString()}`);

        // 4. Check for "Orphaned" data (where institutionId is missing)
        if (accountCounts > accountsWithInst) {
            console.log('⚠️ WARNING: Found accounts with NO institutionId. These will show as 0 on scoped dashboards.');
        }

        console.log('--- End of Diagnostic ---');
        process.exit(0);
    } catch (error) {
        console.error('Diagnostic failed:', error);
        process.exit(1);
    }
}

diagnostic();
