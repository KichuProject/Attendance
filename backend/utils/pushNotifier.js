/**
 * Push Notification Utility for Expo / FCM Push Gateway
 * Sends high-priority push notifications with actionable payload data.
 */

/**
 * Send batch push notifications via Expo Push Gateway
 * @param {Array<{to: string, title: string, body: string, data?: object, sound?: string, priority?: string, channelId?: string}>} messages
 */
async function sendExpoPushNotifications(messages) {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  // Filter messages that have non-empty Expo push tokens
  const validMessages = messages.filter(
    (m) =>
      m &&
      typeof m.to === 'string' &&
      m.to.trim().length > 0 &&
      (m.to.startsWith('ExponentPushToken[') || m.to.startsWith('ExpoPushToken['))
  );

  if (validMessages.length === 0) {
    console.log('[Push Notifier] No valid Expo push tokens found in recipient list.');
    return [];
  }

  // Ensure default sound, high priority, and channelId are configured
  const payload = validMessages.map((msg) => ({
    sound: 'default',
    priority: 'high',
    channelId: 'default',
    ...msg,
  }));

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log(`[Push Notifier] Successfully dispatched ${payload.length} push notification(s) via Expo API.`);
    return data;
  } catch (error) {
    console.error('[Push Notifier] Error dispatching Expo push notifications:', error.message || error);
    return null;
  }
}

/**
 * Notify all HRs about a new employee leave application
 * @param {import('mysql2/promise').Pool} pool - Database connection pool
 * @param {object} leaveData - Leave request details
 */
async function notifyAllHRsLeaveApplied(pool, leaveData) {
  try {
    const { leaveId, userId, empId, name, leaveType, fromDate, toDate, reason } = leaveData;

    // Fetch all active HR users with registered push tokens
    const [hrUsers] = await pool.query(
      `SELECT id, name, emp_id, username, push_token 
       FROM users 
       WHERE (
         LOWER(TRIM(role)) IN ('hr', 'manager') 
         OR LOWER(TRIM(username)) LIKE '%hr%' 
         OR LOWER(TRIM(username)) IN ('hr', 'manager', 'hrr')
       )
       AND push_token IS NOT NULL 
       AND push_token != ''`
    );

    if (!hrUsers || hrUsers.length === 0) {
      console.log('[Leave Notification] ⚠️ No HR users with registered push tokens found in DB.');
      return { success: false, message: 'No registered HR push tokens' };
    }

    console.log(`[Leave Notification] 📋 Found ${hrUsers.length} HR recipient(s): ${hrUsers.map(h => `${h.name || h.username} (${h.push_token})`).join(', ')}`);

    const applicantName = name?.trim() || 'Employee';
    const applicantEmpId = empId && empId !== '--' ? ` (${empId})` : '';

    const messages = hrUsers.map((hr) => ({
      to: hr.push_token,
      title: 'Leave Request Received',
      body: `${applicantName}${applicantEmpId} applied for ${leaveType} (${fromDate} to ${toDate}). Reason: ${reason || 'Not specified'}`,
      data: {
        screen: 'Approvals',
        type: 'LEAVE_APPLICATION',
        leaveId,
        applicantUserId: userId,
        applicantEmpId: empId,
        applicantName,
        leaveType,
        fromDate,
        toDate,
        reason,
      },
    }));

    const result = await sendExpoPushNotifications(messages);
    console.log(`[Leave Notification] Dispatched leave application alert to ${hrUsers.length} HR(s) for ${applicantName}.`);
    return { success: true, count: hrUsers.length, result };
  } catch (error) {
    console.error('[Leave Notification] Error notifying HRs:', error.message || error);
    return { success: false, error: error.message };
  }
}

/**
 * Notify an employee when HR updates (approves / rejects) their leave request
 * @param {import('mysql2/promise').Pool} pool - Database connection pool
 * @param {number|string} leaveId - Leave request ID
 * @param {string} newStatus - 'Approved' | 'Rejected'
 */
async function notifyEmployeeLeaveStatus(pool, leaveId, newStatus) {
  try {
    const [rows] = await pool.query(
      `SELECT l.id, l.user_id, l.leave_type,
              DATE_FORMAT(l.from_date, '%Y-%m-%d') AS from_date,
              DATE_FORMAT(l.to_date, '%Y-%m-%d') AS to_date,
              u.push_token, u.name
       FROM leave_requests l
       JOIN users u ON l.user_id = u.id
       WHERE l.id = ? AND u.push_token IS NOT NULL AND u.push_token != ''`,
      [leaveId]
    );

    if (!rows || rows.length === 0) {
      return { success: false, message: 'No push token found for employee' };
    }

    const row = rows[0];
    const message = {
      to: row.push_token,
      title: `Leave Request ${newStatus}`,
      body: `Your ${row.leave_type} (${row.from_date} to ${row.to_date}) has been ${newStatus.toLowerCase()} by HR.`,
      data: {
        screen: 'Leave',
        type: 'LEAVE_STATUS_UPDATE',
        status: newStatus,
        leaveId: row.id,
      },
    };

    const result = await sendExpoPushNotifications([message]);
    console.log(`[Leave Notification] Notified employee ${row.name} that leave #${leaveId} was ${newStatus}.`);
    return { success: true, result };
  } catch (error) {
    console.error('[Leave Notification] Error notifying employee:', error.message || error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendExpoPushNotifications,
  notifyAllHRsLeaveApplied,
  notifyEmployeeLeaveStatus,
};
