const { getDashboardStats } = require('../controllers/dashboardController');
const { User } = require('../models');

async function simulateDashboardRequest() {
    try {
        console.log('--- Simulating Admin Dashboard API Call ---');
        
        // Simulating the user 'Office Secretary' (id: 2, staff, institutionId: 1)
        const mockUser = await User.findByPk(2);
        
        const req = {
            user: mockUser,
            institutionId: mockUser.institutionId,
            query: { type: 'system' }
        };

        const res = {
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                console.log('API RESPONSE STATUS:', this.statusCode);
                console.log('API RESPONSE DATA:', JSON.stringify(data, null, 2));
            }
        };

        await getDashboardStats(req, res, (err) => {
            if (err) {
                console.error('CONTROLLER ERROR DETECTED:', err.message);
                console.error('STACK:', err.stack);
            }
        });

        console.log('--- Simulation Complete ---');
        process.exit(0);
    } catch (error) {
        console.error('Simulation failed:', error);
        process.exit(1);
    }
}

simulateDashboardRequest();
