const { User, UserSavingsPlan, sequelize } = require('../models');

async function backfill() {
    try {
        console.log('--- Backfilling Institution IDs for UserSavingsPlans ---');
        
        const plans = await UserSavingsPlan.findAll({
            where: { institutionId: null },
            include: [{ model: User, as: 'user' }]
        });

        console.log(`Found ${plans.length} plans with missing institutionId.`);

        let updatedCount = 0;
        for (const plan of plans) {
            if (plan.user && plan.user.institutionId) {
                await plan.update({ institutionId: plan.user.institutionId });
                updatedCount++;
            }
        }

        console.log(`Successfully backfilled ${updatedCount} plans.`);
        process.exit(0);
    } catch (error) {
        console.error('Backfill failed:', error);
        process.exit(1);
    }
}

backfill();
