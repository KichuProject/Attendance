const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'attendance_secret_key';

router.post('/register', async (req, res) => {
  try {
    const { name, username, password, role } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({ error: 'Name, username, and password are required' });
    }

    if (username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const reqRole = (role || '').toLowerCase().trim();
    const userRole = (reqRole === 'hr' || reqRole === 'manager') ? 'hr' : 'employee';
    const [maxIdRows] = await pool.query('SELECT MAX(id) AS maxId FROM users');
    const nextId = (maxIdRows[0].maxId || 0) + 1;
    const employeeId = userRole === 'hr' ? `HR-${String(1000 + nextId)}` : `EMP-${String(1000 + nextId)}`;
    const employeeName = name.trim();

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      'INSERT INTO users (username, password, emp_id, name, role) VALUES (?, ?, ?, ?, ?)',
      [username.trim(), hashedPassword, employeeId, employeeName, userRole]
    );

    const newUser = {
      id: result.insertId,
      username: username.trim(),
      name: employeeName,
      empId: employeeId,
      role: userRole,
      project: null,
    };

    const token = jwt.sign(newUser, JWT_SECRET, { expiresIn: '1h' });

    res.status(201).json({
      success: true,
      message: `${userRole === 'hr' ? 'HR' : 'Employee'} registered successfully`,
      token,
      expiresIn: 3600,
      user: newUser,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const [rows] = await pool.query(
      'SELECT id, username, password, emp_id, name, role FROM users WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = rows[0];

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Fetch user's assigned project
    let assignedProject = null;
    try {
      const [projectRows] = await pool.query(`
        SELECT p.id, p.name, p.code, p.client, p.color, ep.role_in_project
        FROM employee_projects ep
        JOIN projects p ON ep.project_id = p.id
        WHERE ep.user_id = ?
        LIMIT 1
      `, [user.id]);

      if (projectRows.length > 0) {
        assignedProject = {
          id: projectRows[0].id,
          name: projectRows[0].name,
          code: projectRows[0].code,
          client: projectRows[0].client,
          color: projectRows[0].color,
          roleInProject: projectRows[0].role_in_project || 'Member',
        };
      }
    } catch (_projErr) {
      // Ignore if projects table is empty
    }

    const userRole = (user.role === 'manager' || user.role === 'hr' || user.username === 'hr' || user.username === 'manager') ? 'hr' : 'employee';

    const userData = {
      id: user.id,
      username: user.username,
      empId: user.emp_id,
      name: user.name,
      role: userRole,
      project: assignedProject,
    };

    const token = jwt.sign(userData, JWT_SECRET, { expiresIn: '1h' });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      expiresIn: 3600,
      user: userData,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Verify token session route
router.get('/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({
        success: false,
        error: err.name === 'TokenExpiredError' ? 'Session expired (1 hour limit reached)' : 'Invalid token',
      });
    }
    res.json({ success: true, user: decoded });
  });
});

module.exports = router;

