const { User, UserSavingsPlan, Account } = require('../models');

async function checkUser() {
    try {
        const user = await User.findOne({ where: { email: 'emmanuel.c@coop001.com' } });
        if (!user) {
            console.log('User not found');
            process.exit(0);
        }

        console.log(`User: ${user.name} (ID: ${user.id}, InstitutionID: ${user.institutionId})`);

        const plans = await UserSavingsPlan.findAll({
            where: { userId: user.id }
        });

        console.log(`\nSavings Plans found (Total: ${plans.length}):`);
        plans.forEach((p, i) => {
            console.log(`Plan ${i + 1}: ${p.planName || 'Unnamed'} (ID: ${p.id}, InstitutionID: ${p.institutionId}, Status: ${p.status})`);
        });

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkUser();
