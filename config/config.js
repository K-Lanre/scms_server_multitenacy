

require('dotenv').config();

const dialectOptions = process.env.DB_SSL === 'true'
  ? {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  : {};

const splitDatabaseConfig = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  dialect: 'postgres',
  dialectOptions
};

const productionConfig = process.env.DATABASE_URL
  ? {
      use_env_variable: 'DATABASE_URL',
      dialect: 'postgres',
      dialectOptions
    }
  : splitDatabaseConfig;

module.exports = {
  development: splitDatabaseConfig,
  test: {
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false
  },
  production: productionConfig
}
