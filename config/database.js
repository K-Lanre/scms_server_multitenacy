const { Sequelize } = require("sequelize");
require("dotenv").config();


const env = process.env.NODE_ENV || "development";

const sequelize =
    env === "test"
        ? new Sequelize("sqlite::memory:", { logging: false })
        : new Sequelize(
            process.env.DB_NAME,
            process.env.DB_USER,
            process.env.DB_PASSWORD,
            {
                host: process.env.DB_HOST,
                dialect: "mysql",
                logging: false,
                pool: {
                    max: 10,
                    min: 0,
                    acquire: 30000,
                    idle: 10000
                },
                dialectOptions: {
                    connectTimeout: 60000,
                }
            }
        );

// Set max_allowed_packet to 64MB per connection session after each connection is established.
// This prevents "Got a packet bigger than 'max_allowed_packet' bytes" errors
// when saving JSON fields or uploading files — works without MySQL SUPER/GLOBAL privileges.
sequelize.afterConnect(async (connection) => {
    try {
        // Use callback-style query (reliable with MySQL2 pool connections in Sequelize)
        await new Promise((resolve, reject) => {
            connection.query('SET SESSION max_allowed_packet = 67108864', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    } catch (err) {
        console.warn('[DB] Could not set max_allowed_packet session variable:', err.message);
    }
});

async function connectDB() {
    try {
        await sequelize.authenticate();
        console.log("Database connection has been established successfully.");
    } catch (error) {
        console.error("Unable to connect to the database:", error);
    }
}

const syncDB = async () => {
    try {
        await sequelize.sync({ force: true });
        console.log("Database synchronized successfully.");
    } catch (error) {
        console.error("Unable to synchronize the database:", error);
    }
}

module.exports = { sequelize, Sequelize, connectDB, syncDB };
