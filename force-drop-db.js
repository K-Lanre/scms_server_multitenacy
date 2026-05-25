require('dotenv').config();
const { Client } = require('pg');

async function forceDropDatabase() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: 'postgres' // Connect to default database
  };

  console.log('Connecting with config:', {
    host: config.host,
    port: config.port,
    user: config.user,
    database: config.database,
    password: config.password ? '***' : 'undefined'
  });

  const client = new Client(config);

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Kill all connections to the scms database
    await client.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'scms' AND pid <> pg_backend_pid()");
    console.log('Terminated all connections to scms database');

    // Drop the database
    await client.query("DROP DATABASE IF EXISTS scms");
    console.log('Dropped scms database');

    // Recreate the database
    await client.query("CREATE DATABASE scms");
    console.log('Created scms database');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

forceDropDatabase();
