const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// 1. Submit a leave request (Employee)
router.post('/request', async (req, res) => {
  try {
    const { userId, empId, name, leaveType, fromDate, toDate, reason } = req.body;

    if (!userId || !leaveType || !fromDate || !toDate || !reason) {
      return res.status(400).json({ error: 'All fields are required for leave request' });
    }

    const [result] = await pool.query(
      `INSERT INTO leave_requests (user_id, emp_id, name, leave_type, from_date, to_date, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [userId, empId || '--', name || 'Employee', leaveType, fromDate, toDate, reason]
    );

    const newRequest = {
      id: result.insertId,
      userId,
      empId,
      name,
      leaveType,
      from: fromDate,
      to: toDate,
      reason,
      status: 'Pending',
    };

    res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully',
      data: newRequest,
    });
  } catch (error) {
    console.error('Leave submit error:', error);
    res.status(500).json({ error: 'Failed to submit leave request' });
  }
});

// 2. Get all leave requests (Manager)
router.get('/all', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, user_id, emp_id, name, leave_type,
              DATE_FORMAT(from_date, '%Y-%m-%d') AS from_date,
              DATE_FORMAT(to_date, '%Y-%m-%d') AS to_date,
              reason, status, created_at
       FROM leave_requests
       ORDER BY created_at DESC`
    );

    const requests = rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      empId: r.emp_id,
      name: r.name,
      leaveType: r.leave_type,
      from: r.from_date,
      to: r.to_date,
      reason: r.reason,
      status: r.status,
      createdAt: r.created_at,
    }));

    res.json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (error) {
    console.error('Fetch all leave error:', error);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
});

// 3. Get leave requests for a single employee
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [rows] = await pool.query(
      `SELECT id, user_id, emp_id, name, leave_type,
              DATE_FORMAT(from_date, '%Y-%m-%d') AS from_date,
              DATE_FORMAT(to_date, '%Y-%m-%d') AS to_date,
              reason, status, created_at
       FROM leave_requests
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    const requests = rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      empId: r.emp_id,
      name: r.name,
      leaveType: r.leave_type,
      from: r.from_date,
      to: r.to_date,
      reason: r.reason,
      status: r.status,
      createdAt: r.created_at,
    }));

    res.json({
      success: true,
      requests,
    });
  } catch (error) {
    console.error('Fetch user leave error:', error);
    res.status(500).json({ error: 'Failed to fetch user leave requests' });
  }
});

// 4. Update status (Manager: Approve / Reject)
router.put('/status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await pool.query(
      'UPDATE leave_requests SET status = ? WHERE id = ?',
      [status, id]
    );

    res.json({
      success: true,
      message: `Leave request ${status.toLowerCase()} successfully`,
      data: { id: Number(id), status },
    });
  } catch (error) {
    console.error('Update leave status error:', error);
    res.status(500).json({ error: 'Failed to update leave status' });
  }
});

module.exports = router;

