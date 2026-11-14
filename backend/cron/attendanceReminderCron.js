const cron = require('node-cron');
const { pool } = require('../config/db');

/**
 * Send batch push notifications via Expo / FCM Push Gateway
 * @param {Array<{to: string, title: string, body: string, data?: object}>} messages
 */
async function sendExpoPushNotifications(messages) {
  if (!messages || messages.length === 0) return [];

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[Push Service] Error dispatching Expo push notifications:', error.message);
    return null;
  }
}

/**
 * Core function to check and send 9:45 AM attendance reminders (15 mins before 10:00 AM)
 * @param {boolean} isManualTest - If true, skips time check for instant testing
 */
async function runAttendanceReminderJob(isManualTest = false) {
  try {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday

    // Skip on Sundays unless manual test
    if (dayOfWeek === 0 && !isManualTest) {
      return { success: true, message: 'Sunday skipped: Non-working day', count: 0 };
    }

    // Find all active employees who:
    // 1. Have a valid push_token
    // 2. Have NOT checked in today (status != 'IN' or no attendance record for today)
    // 3. Have NOT already received today's reminder
    // 4. Are NOT on an approved leave today
    const [eligibleUsers] = await pool.query(`
      SELECT u.id, u.name, u.emp_id, u.push_token
      FROM users u
      WHERE u.push_token IS NOT NULL
        AND u.push_token != ''
        AND NOT EXISTS (
          SELECT 1 FROM attendance a
          WHERE a.user_id = u.id
            AND a.date = CURDATE()
            AND a.status IN ('IN', 'OUT')
        )
        AND NOT EXISTS (
          SELECT 1 FROM checkin_reminders r
          WHERE r.user_id = u.id
            AND r.reminder_date = CURDATE()
        )
        AND NOT EXISTS (
          SELECT 1 FROM leave_requests l
          WHERE l.user_id = u.id
            AND l.status = 'Approved'
            AND CURDATE() BETWEEN l.from_date AND l.to_date
        )
    `);

    if (eligibleUsers.length === 0) {
      console.log('[Attendance Cron] No pending employees found for 9:45 AM reminder (all checked in, reminded, or on leave).');
      return { success: true, count: 0, message: 'No pending employees to notify' };
    }

    console.log(`[Attendance Cron] Preparing 9:45 AM check-in reminder for ${eligibleUsers.length} employee(s)...`);

    // Prepare push notification messages
    const pushMessages = eligibleUsers.map((user) => ({
      to: user.push_token,
      sound: 'default',
      priority: 'high',
      channelId: 'default',
      title: 'Office Time Reminder ⏰',
      body: `Good morning ${user.name}! Office starts at 10:00 AM. 15 minutes left to check in!`,
      data: {
        type: 'CHECKIN_REMINDER',
        officeStartTime: '10:00 AM',
        target: 'PunchIn',
      },
    }));

    // Send via Expo Push Gateway
    const result = await sendExpoPushNotifications(pushMessages);

    // Record in checkin_reminders to prevent duplicate alerts
    for (const user of eligibleUsers) {
      try {
        await pool.query(
          `INSERT INTO checkin_reminders (user_id, reminder_date, office_start_time)
           VALUES (?, CURDATE(), '10:00 AM')
           ON DUPLICATE KEY UPDATE sent_at = CURRENT_TIMESTAMP`,
          [user.id]
        );
      } catch (_recErr) { }
    }

    console.log(`[Attendance Cron] Successfully sent check-in reminders to ${eligibleUsers.length} employee(s).`);

    return {
      success: true,
      count: eligibleUsers.length,
      employees: eligibleUsers.map((u) => u.name),
      expoResult: result,
    };
  } catch (error) {
    console.error('[Attendance Cron] Error executing reminder job:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Initialize the scheduled cron job
 * Runs every day (Mon-Sat) at 9:45 AM (15 mins before 10:00 AM start time)
 * Cron pattern: '45 9 * * 1-6' -> 09:45 AM, Monday through Saturday
 */
function initializeAttendanceCron() {
  // Cron schedule: 9:45 AM, Monday to Saturday
  cron.schedule('45 9 * * 1-6', async () => {
    console.log('[Attendance Cron] ⏰ 09:45 AM trigger fired: Running check-in reminder job...');
    await runAttendanceReminderJob(false);
  });

  console.log('⏰ Attendance Check-IN Cron initialized: Runs Mon-Sat at 09:45 AM (15m before 10:00 AM).');
}

module.exports = {
  initializeAttendanceCron,
  runAttendanceReminderJob,
  sendExpoPushNotifications,
};
