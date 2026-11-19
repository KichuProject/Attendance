const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const {
  notifyAllHRsLeaveApplied,
  notifyEmployeeLeaveStatus,
} = require('../utils/pushNotifier');

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

    // Instant notification to all HRs with push tokens
    console.log(`[Leave Route] 📝 New leave request #${result.insertId} by ${name || 'Employee'} (${empId}). Triggering HR push notifications...`);
    notifyAllHRsLeaveApplied(pool, {
      leaveId: result.insertId,
      userId,
      empId,
      name,
      leaveType,
      fromDate,
      toDate,
      reason,
    }).catch((notifErr) => {
      console.error('[Leave Route] Background HR notification error:', notifErr.message);
    });

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

// 3. Get leave requests & calculated yearly balance for an employee
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const TOTAL_YEARLY_QUOTA = 15;
    const currentYear = new Date().getFullYear();

    const [rows] = await pool.query(
      `SELECT id, user_id, emp_id, name, leave_type,
              DATE_FORMAT(from_date, '%Y-%m-%d') AS from_date,
              DATE_FORMAT(to_date, '%Y-%m-%d') AS to_date,
              reason, status, created_at
       FROM leave_requests
       WHERE user_id = ? OR emp_id = ?
       ORDER BY created_at DESC`,
      [userId, userId]
    );

    let approvedDays = 0;
    let pendingDays = 0;

    const requests = rows.map((r) => {
      const fromStr = r.from_date;
      const toStr = r.to_date;
      let daysCount = 1;

      if (fromStr && toStr) {
        const p1 = fromStr.split('-').map(Number);
        const p2 = toStr.split('-').map(Number);
        if (p1.length === 3 && p2.length === 3) {
          const t1 = new Date(p1[0], p1[1] - 1, p1[2]).getTime();
          const t2 = new Date(p2[0], p2[1] - 1, p2[2]).getTime();
          daysCount = Math.max(1, Math.round((t2 - t1) / (1000 * 60 * 60 * 24)) + 1);
        }
      }

      // Count leaves in current year towards quota (1 request = 1 leave)
      const reqYear = parseInt(fromStr ? fromStr.split('-')[0] : currentYear, 10);
      if (reqYear === currentYear) {
        if (r.status === 'Approved') {
          approvedDays += 1;
        } else if (r.status === 'Pending') {
          pendingDays += 1;
        }
      }

      return {
        id: r.id,
        userId: r.user_id,
        empId: r.emp_id,
        name: r.name,
        leaveType: r.leave_type,
        from: r.from_date,
        to: r.to_date,
        daysCount,
        reason: r.reason,
        status: r.status,
        createdAt: r.created_at,
      };
    });

    const remainingDays = Math.max(0, TOTAL_YEARLY_QUOTA - approvedDays - pendingDays);
    const percentUsed = Math.min(100, Math.round(((approvedDays + pendingDays) / TOTAL_YEARLY_QUOTA) * 100));

    res.json({
      success: true,
      wallet: {
        total: TOTAL_YEARLY_QUOTA,
        approvedDays,
        pendingDays,
        remainingDays,
        percentUsed,
      },
      count: requests.length,
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

    // Notify employee of approval/rejection asynchronously
    if (status === 'Approved' || status === 'Rejected') {
      notifyEmployeeLeaveStatus(pool, id, status).catch((err) => {
        console.error('[Leave Route] Background employee notification error:', err.message);
      });
    }

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

// 5. Manual Test Trigger: Send test leave notification to all HRs
router.post('/test-hr-notification', async (req, res) => {
  try {
    const testResult = await notifyAllHRsLeaveApplied(pool, {
      leaveId: 9999,
      userId: 9999,
      empId: 'TEST-101',
      name: req.body.name || 'Test Employee',
      leaveType: req.body.leaveType || 'Sick Leave',
      fromDate: req.body.fromDate || new Date().toISOString().split('T')[0],
      toDate: req.body.toDate || new Date().toISOString().split('T')[0],
      reason: req.body.reason || 'Verification test for HR push notification alert',
    });

    res.json({
      success: true,
      message: 'Test notification triggered for all HRs',
      result: testResult,
    });
  } catch (error) {
    console.error('Test HR notification error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

