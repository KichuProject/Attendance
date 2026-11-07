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
      SELECT a.id, a.date, a.status, a.in_time, a.out_time,
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

module.exports = router;

