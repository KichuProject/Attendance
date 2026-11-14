const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

function formatDateString(dateObj) {
  if (!dateObj) return '';
  const d = new Date(dateObj);
  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

router.get('/today/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // 1. Fetch today's record
    const [todayRows] = await pool.query(
      `SELECT status, in_time, out_time, latitude, longitude, out_latitude, out_longitude
       FROM attendance
       WHERE user_id = ? AND date = CURDATE()`,
      [userId]
    );

    const todayRecord = todayRows.length > 0 ? todayRows[0] : null;

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as totalDays
       FROM attendance
       WHERE user_id = ? AND status IN ('IN', 'OUT')`,
      [userId]
    );

    res.json({
      success: true,
      today: {
        status: todayRecord ? todayRecord.status : 'NOT IN',
        inTime: todayRecord ? todayRecord.in_time : null,
        outTime: todayRecord ? todayRecord.out_time : null,
        latitude: todayRecord ? todayRecord.latitude : null,
        longitude: todayRecord ? todayRecord.longitude : null,
        outLatitude: todayRecord ? todayRecord.out_latitude : null,
        outLongitude: todayRecord ? todayRecord.out_longitude : null,
      },
      totalDays: countRows[0].totalDays || 0,
    });
  } catch (error) {
    console.error('Error fetching today status:', error);
    res.status(500).json({ error: 'Failed to fetch today attendance' });
  }
});

router.post('/check-in', async (req, res) => {
  try {
    const { userId, inTime, latitude, longitude } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!latitude || !longitude || latitude === '--' || longitude === '--') {
      return res.status(400).json({ success: false, error: 'GPS location is required to Check IN. Please turn ON location.' });
    }

    const time = inTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    const [existing] = await pool.query(
      'SELECT id, status FROM attendance WHERE user_id = ? AND date = CURDATE()',
      [userId]
    );

    if (existing.length > 0 && (existing[0].status === 'IN' || existing[0].status === 'OUT')) {
      return res.status(400).json({ error: 'Already checked in today' });
    }

    await pool.query(
      `INSERT INTO attendance (user_id, date, status, in_time, latitude, longitude)
       VALUES (?, CURDATE(), 'IN', ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status = 'IN',
         in_time = VALUES(in_time),
         latitude = VALUES(latitude),
         longitude = VALUES(longitude)`,
      [userId, time, latitude || null, longitude || null]
    );

    res.json({
      success: true,
      message: 'Checked IN successfully',
      data: {
        status: 'IN',
        inTime: time,
        latitude,
        longitude,
      },
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Failed to record Check-IN' });
  }
});

router.post('/check-out', async (req, res) => {
  try {
    const { userId, outTime, outLatitude, outLongitude } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!outLatitude || !outLongitude || outLatitude === '--' || outLongitude === '--') {
      return res.status(400).json({ success: false, error: 'GPS location is required to Check OUT. Please turn ON location.' });
    }

    const [existing] = await pool.query(
      'SELECT id, status FROM attendance WHERE user_id = ? AND date = CURDATE()',
      [userId]
    );

    if (existing.length === 0 || existing[0].status === 'NOT IN') {
      return res.status(400).json({ error: 'You must check IN first before checking OUT' });
    }

    if (existing[0].status === 'OUT') {
      return res.status(400).json({ error: 'Already checked OUT today' });
    }

    const time = outTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    await pool.query(
      `UPDATE attendance
       SET status = 'OUT', out_time = ?, out_latitude = ?, out_longitude = ?
       WHERE user_id = ? AND date = CURDATE()`,
      [time, outLatitude || null, outLongitude || null, userId]
    );

    res.json({
      success: true,
      message: 'Checked OUT successfully',
      data: { status: 'OUT', outTime: time, outLatitude, outLongitude },
    });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ error: 'Failed to record Check-OUT' });
  }
});

router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { fromDate, toDate } = req.query;

    let query = `
      SELECT a.id, DATE_FORMAT(a.date, '%Y-%m-%d') as raw_date, a.date, a.status, a.in_time, a.out_time,
             a.latitude, a.longitude, a.out_latitude, a.out_longitude,
             u.emp_id, u.name
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE a.user_id = ?
    `;
    const params = [userId];

    if (fromDate) {
      query += ` AND a.date >= ?`;
      params.push(fromDate);
    }

    if (toDate) {
      query += ` AND a.date <= ?`;
      params.push(toDate);
    }

    query += ` ORDER BY a.date DESC`;

    const [rows] = await pool.query(query, params);

    const history = rows.map((r, index) => ({
      id: String(r.id),
      sno: index + 1,
      empId: r.emp_id,
      name: r.name,
      date: formatDateString(r.date),
      rawDate: r.raw_date,
      status: r.status,
      inTime: r.in_time || '--:--',
      outTime: r.out_time || '--:--',
      latitude: r.latitude || '--',
      longitude: r.longitude || '--',
      outLatitude: r.out_latitude || '--',
      outLongitude: r.out_longitude || '--',
    }));

    res.json({
      success: true,
      count: history.length,
      records: history,
    });
  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance history' });
  }
});

// 4b. Get attendance history across all non-HR employees (HR)
router.get('/history-all', async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    let query = `
      SELECT a.id, DATE_FORMAT(a.date, '%Y-%m-%d') as raw_date, a.date, a.status, a.in_time, a.out_time,
             a.latitude, a.longitude, a.out_latitude, a.out_longitude,
             u.id as user_id, u.emp_id, u.name, u.role
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE u.role != 'manager' AND u.role != 'hr' AND u.username != 'hr' AND u.username != 'hrr'
    `;
    const params = [];

    if (fromDate) {
      query += ` AND a.date >= ?`;
      params.push(fromDate);
    }

    if (toDate) {
      query += ` AND a.date <= ?`;
      params.push(toDate);
    }

    query += ` ORDER BY a.date DESC, u.name ASC`;

    const [rows] = await pool.query(query, params);

    const history = rows.map((r, index) => ({
      id: String(r.id),
      sno: index + 1,
      userId: r.user_id,
      empId: r.emp_id,
      name: r.name,
      date: formatDateString(r.date),
      rawDate: r.raw_date,
      status: r.status,
      inTime: r.in_time || '--:--',
      outTime: r.out_time || '--:--',
      latitude: r.latitude || '--',
      longitude: r.longitude || '--',
      outLatitude: r.out_latitude || '--',
      outLongitude: r.out_longitude || '--',
    }));

    res.json({
      success: true,
      count: history.length,
      records: history,
    });
  } catch (error) {
    console.error('All history fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch all attendance history' });
  }
});

// 5. Get all team employees with their today attendance status & mapped project (HR)
router.get('/team-summary', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.name, u.username, u.emp_id, u.role, u.created_at,
             (SELECT MIN(date) FROM attendance WHERE user_id = u.id) as first_attendance,
             (SELECT MIN(from_date) FROM leave_requests WHERE user_id = u.id) as first_leave,
             a.status as today_status,
             a.in_time, a.out_time,
             a.latitude, a.longitude,
             a.out_latitude, a.out_longitude,
             (SELECT COUNT(*) FROM attendance WHERE user_id = u.id AND status IN ('IN', 'OUT')) as total_punches,
             (SELECT COUNT(*) FROM leave_requests WHERE user_id = u.id AND status = 'Approved') as total_leaves,
             (SELECT id FROM leave_requests WHERE user_id = u.id AND status = 'Approved' AND CURDATE() BETWEEN from_date AND to_date LIMIT 1) as active_leave_id,
             p.id as project_id,
             p.name as project_name,
             p.code as project_code,
             p.color as project_color,
             p.client as project_client,
             ep.role_in_project
      FROM users u
      LEFT JOIN attendance a ON u.id = a.user_id AND a.date = CURDATE()
      LEFT JOIN employee_projects ep ON u.id = ep.user_id
      LEFT JOIN projects p ON ep.project_id = p.id
      WHERE u.role != 'manager' AND u.role != 'hr' AND u.username != 'hr' AND u.username != 'hrr' AND u.username != 'manager'
      ORDER BY u.name ASC
    `);

    res.json({
      success: true,
      count: rows.length,
      employees: rows.map((r) => {
        let finalStatus = r.today_status;
        if (!finalStatus) {
          finalStatus = r.active_leave_id ? 'LEAVE' : 'NOT IN';
        }
        let effCreated = r.created_at ? new Date(r.created_at) : new Date();
        if (r.first_attendance) {
          const fAtt = new Date(r.first_attendance);
          if (!isNaN(fAtt.getTime()) && fAtt < effCreated) {
            effCreated = fAtt;
          }
        }
        if (r.first_leave) {
          const fLv = new Date(r.first_leave);
          if (!isNaN(fLv.getTime()) && fLv < effCreated) {
            effCreated = fLv;
          }
        }
        return {
          id: r.id,
          name: r.name,
          username: r.username,
          empId: r.emp_id,
          role: r.role,
          createdAt: effCreated.toISOString(),
          status: finalStatus,
          todayStatus: finalStatus,
          inTime: r.in_time || null,
          outTime: r.out_time || null,
          latitude: r.latitude || null,
          longitude: r.longitude || null,
          outLatitude: r.out_latitude || null,
          outLongitude: r.out_longitude || null,
          totalDays: r.total_punches || 0,
          totalPunches: r.total_punches || 0,
          totalLeaves: r.total_leaves || 0,
          project: r.project_id ? {
            id: r.project_id,
            name: r.project_name,
            code: r.project_code,
            color: r.project_color || '#EA580C',
            client: r.project_client || 'Tech Sigaram',
            roleInProject: r.role_in_project || 'Member',
          } : null,
        };
      }),
    });
  } catch (error) {
    console.error('Fetch team summary error:', error);
    res.status(500).json({ error: 'Failed to fetch team summary' });
  }
});

module.exports = router;

