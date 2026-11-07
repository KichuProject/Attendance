const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'attendance_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Create a connection pool for queries
const pool = mysql.createPool(dbConfig);

// Automatically initialize database and required tables
async function initializeDatabase() {
  try {
    // 1. Connect without selecting database to ensure database exists
    const tempConnection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
    });

    await tempConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\`;`
    );
    await tempConnection.end();

    // 2. Create Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        emp_id VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        role VARCHAR(20) DEFAULT 'employee',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Ensure role column exists if table was created previously without it
    try {
      await pool.query("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'employee'");
    } catch (e) {
      // Ignore if already exists
    }

    // 4. Seed or update Manager account
    const [managerRows] = await pool.query("SELECT id FROM users WHERE username = 'manager'");
    if (managerRows.length === 0) {
      const hashedPassword = await bcrypt.hash('manager123', 10);
      await pool.query(
        "INSERT INTO users (username, password, emp_id, name, role) VALUES (?, ?, ?, ?, ?)",
        ['manager', hashedPassword, 'MGR-001', 'Manager', 'manager']
      );
      console.log(" Seeded manager account ('manager' / 'manager123') in MySQL.");
    }

    // 5. Create Attendance table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        date DATE NOT NULL,
        status ENUM('IN', 'OUT', 'NOT IN') DEFAULT 'NOT IN',
        in_time VARCHAR(20) DEFAULT NULL,
        out_time VARCHAR(20) DEFAULT NULL,
        latitude VARCHAR(50) DEFAULT NULL,
        longitude VARCHAR(50) DEFAULT NULL,
        out_latitude VARCHAR(50) DEFAULT NULL,
        out_longitude VARCHAR(50) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_date (user_id, date),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Ensure out_latitude/out_longitude exist on attendance if created previously without them
    try {
      await pool.query("ALTER TABLE attendance ADD COLUMN out_latitude VARCHAR(50) NULL, ADD COLUMN out_longitude VARCHAR(50) NULL");
    } catch (e) {
      // Ignore if already exists
    }

    // 6. Create Leave Requests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        emp_id VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        leave_type VARCHAR(50) NOT NULL,
        from_date VARCHAR(30) NOT NULL,
        to_date VARCHAR(30) NOT NULL,
        reason TEXT NOT NULL,
        status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    console.log(` MySQL Connected & Database '${dbConfig.database}' initialized successfully.`);
  } catch (error) {
    console.error(' MySQL Initialization Error:', error.message);
    console.log(' Tip: Check your MySQL credentials in backend/.env');
  }
}

module.exports = { pool, initializeDatabase };

