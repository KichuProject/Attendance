const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const getSslConfig = () => {
  const caPath = process.env.CA || process.env.DB_CA_PATH;
  if (caPath) {
    try {
      if (fs.existsSync(caPath)) {
        return { ca: fs.readFileSync(caPath), minVersion: 'TLSv1.2', rejectUnauthorized: true };
      }
    } catch (e) {
      // If path cannot be read directly, use system/Node default TLS
    }
    return { minVersion: 'TLSv1.2', rejectUnauthorized: true };
  }
  if (process.env.DB_HOST && process.env.DB_HOST.includes('tidbcloud.com')) {
    return { minVersion: 'TLSv1.2', rejectUnauthorized: true };
  }
  return undefined;
};

const sslConfig = getSslConfig();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'attendance_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ...(sslConfig ? { ssl: sslConfig } : {}),
};

// Create a connection pool for queries
const pool = mysql.createPool(dbConfig);

// Automatically initialize database and required tables
async function initializeDatabase() {
  try {
    // 1. Connect without selecting database to ensure database exists
    try {
      const tempConnection = await mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        ...(sslConfig ? { ssl: sslConfig } : {}),
      });

      await tempConnection.query(
        `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\`;`
      );
      await tempConnection.end();
    } catch (dbErr) {
      // In managed cloud databases like TiDB, database may already exist or permissions managed via console
    }

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

    // 3. Ensure role & push_token columns exist if table was created previously without them
    try {
      await pool.query("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'employee'");
    } catch (e) {
      // Ignore if already exists
    }
    try {
      await pool.query("ALTER TABLE users ADD COLUMN push_token VARCHAR(255) DEFAULT NULL");
    } catch (e) {
      // Ignore if already exists
    }

    // Ensure checkin_reminders tracking table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS checkin_reminders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        reminder_date DATE NOT NULL,
        office_start_time VARCHAR(20) DEFAULT '10:00 AM',
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_reminder_date (user_id, reminder_date),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Migrate any legacy 'manager' role to 'hr'
    try {
      await pool.query("UPDATE users SET role = 'hr' WHERE role = 'manager'");
    } catch (e) {
      // Ignore
    }

    // 4. Seed or update HR account
    const [hrRows] = await pool.query("SELECT id FROM users WHERE username = 'hr' OR role = 'hr'");
    if (hrRows.length === 0) {
      const hashedPassword = await bcrypt.hash('hr123', 10);
      await pool.query(
        "INSERT INTO users (username, password, emp_id, name, role) VALUES (?, ?, ?, ?, ?)",
        ['hr', hashedPassword, 'HR-001', 'HR Admin', 'hr']
      );
      console.log(" Seeded HR account ('hr' / 'hr123') in MySQL.");
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

    // 7. Create Projects table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        client VARCHAR(150) DEFAULT 'Tech Sigaram',
        description TEXT DEFAULT NULL,
        color VARCHAR(20) DEFAULT '#EA580C',
        status ENUM('active', 'completed', 'on_hold') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    // 8. Create Employee Projects mapping table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employee_projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        project_id INT NOT NULL,
        role_in_project VARCHAR(100) DEFAULT 'Member',
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_project (user_id, project_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);

    // 9. Seed default projects if table is empty
    const [projectCount] = await pool.query('SELECT COUNT(*) as count FROM projects');
    if ((projectCount[0]?.count || 0) === 0) {
      await pool.query(`
        INSERT INTO projects (name, code, client, description, color, status) VALUES
        ('AI Attendance Suite', 'PRJ-ATTEND', 'Tech Sigaram Internal', 'Biometric & geofenced workforce management platform', '#EA580C', 'active'),
        ('FinTech Mobile Banking', 'PRJ-FINTECH', 'Apex Financial Corp', 'Next-gen retail banking app with instant settlement', '#3B82F6', 'active'),
        ('Supply Chain Logistics', 'PRJ-LOGIX', 'Global Cargo Ltd', 'Real-time telemetry and freight tracking portal', '#10B981', 'active'),
        ('Cloud HR Portal', 'PRJ-CLOUDHR', 'Enterprise Corp', 'Centralized employee self-service and payroll suite', '#8B5CF6', 'active')
      `);
      console.log(' Seeded 4 default company projects in MySQL.');
    }

    console.log(` MySQL Connected & Database '${dbConfig.database}' initialized successfully.`);
  } catch (error) {
    console.error(' MySQL Initialization Error:', error.message);
    console.log(' Tip: Check your MySQL credentials in backend/.env');
  }
}

module.exports = { pool, initializeDatabase };

