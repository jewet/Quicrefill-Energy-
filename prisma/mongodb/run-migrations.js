// prisma/mongodb/run-migrations.js
const { MongoClient } = require('mongodb');
const { migrate } = require('./migrations/001_init');

async function runMigrations() {
  const client = new MongoClient(process.env.MONGODB_URL);
  try {
    await client.connect();
    const db = client.db();
    await migrate(db);
    console.log('MongoDB migrations completed');
  } finally {
    await client.close();
  }
}

runMigrations().catch(console.error);