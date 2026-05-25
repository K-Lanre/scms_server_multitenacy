const { Sequelize } = require("sequelize");
require("dotenv").config();

const env = process.env.NODE_ENV || "development";
const useSsl = process.env.DB_SSL === "true";
const dialectOptions = {
    connectTimeout: 60000,
    ...(useSsl
        ? {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        }
        : {})
};

const databaseOptions = {
    dialect: "postgres",
    logging: false,
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    dialectOptions
};

const createDatabaseConnection = () => {
    if (env === "test") {
        return new Sequelize("sqlite::memory:", { logging: false });
    }

    if (env === "production" && process.env.DATABASE_URL) {
        return new Sequelize(process.env.DATABASE_URL, databaseOptions);
    }

    return new Sequelize(
        process.env.DB_NAME,
        process.env.DB_USER,
        process.env.DB_PASSWORD,
        {
            ...databaseOptions,
            host: process.env.DB_HOST
        }
    );
};

const sequelize = createDatabaseConnection();

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
