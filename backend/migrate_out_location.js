require('dotenv').config({ path: __dirname + '/.env' });
const mysql = require('mysql2/promise');

async function run() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    await pool.query(`ALTER TABLE attendance
      ADD COLUMN out_latitude VARCHAR(50) NULL,
      ADD COLUMN out_longitude VARCHAR(50) NULL`);
    console.log('✅ Columns out_latitude and out_longitude added successfully.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️  Columns already exist — skipping.');
    } else {
      throw e;
    }
  }
  await pool.end();
}
run().catch(console.error);
