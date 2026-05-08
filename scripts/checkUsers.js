const { User } = require('../models');

async function checkUsers() {
    try {
        const users = await User.findAll({ attributes: ['id', 'name', 'email', 'role', 'institutionId'] });
        console.table(users.map(u => u.toJSON()));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkUsers();
