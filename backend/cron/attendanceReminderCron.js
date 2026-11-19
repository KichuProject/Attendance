const cron = require('node-cron');
const { pool } = require('../config/db');
const { sendExpoPushNotifications } = require('../utils/pushNotifier');

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
    // 3. Have NOT already received today's reminder (bypassed if manual test)
    // 4. Are NOT on an approved leave today
    const [eligibleUsers] = await pool.query(
      `SELECT u.id, u.name, u.emp_id, u.push_token
      FROM users u
      WHERE u.push_token IS NOT NULL
        AND u.push_token != ''
        AND NOT EXISTS (
          SELECT 1 FROM attendance a
          WHERE a.user_id = u.id
            AND a.date = CURDATE()
            AND a.status IN ('IN', 'OUT')
        )
        AND (
          ? = TRUE
          OR NOT EXISTS (
            SELECT 1 FROM checkin_reminders r
            WHERE r.user_id = u.id
              AND r.reminder_date = CURDATE()
          )
        )
        AND NOT EXISTS (
          SELECT 1 FROM leave_requests l
          WHERE l.user_id = u.id
            AND l.status = 'Approved'
            AND CURDATE() BETWEEN l.from_date AND l.to_date
        )`,
      [Boolean(isManualTest)]
    );

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
      categoryId: 'attendance_reminder',
      title: 'Office Time Reminder',
      body: `Good morning ${user.name}! Office starts at 10:00 AM. 15 minutes left to check in.`,
      data: {
        type: 'CHECKIN_REMINDER',
        officeStartTime: '10:00 AM',
        target: 'PunchIn',
      },
    }));

    // Send via Expo Push Gateway
    const result = await sendExpoPushNotifications(pushMessages);

    // Record in checkin_reminders to prevent duplicate alerts (real cron only, not test)
    if (!isManualTest) {
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
 * Function to check and send Late Check-in Alerts after 10:00 AM (default: 10:05 AM)
 * Fires for any active employee who has NOT punched in after office hours started
 * @param {boolean} isManualTest - If true, skips Sunday check for instant testing
 */
async function runLateAttendanceReminderJob(isManualTest = false) {
  try {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday

    // Skip on Sundays unless manual test
    if (dayOfWeek === 0 && !isManualTest) {
      return { success: true, message: 'Sunday skipped: Non-working day', count: 0 };
    }

    // Find all active employees who:
    // 1. Have a valid push_token
    // 2. Have NOT checked in today (no status IN or OUT)
    // 3. Have NOT already received today's late check-in alert (bypassed if manual test)
    // 4. Are NOT on an approved leave today
    const [eligibleUsers] = await pool.query(
      `SELECT u.id, u.name, u.emp_id, u.push_token
      FROM users u
      WHERE u.push_token IS NOT NULL
        AND u.push_token != ''
        AND NOT EXISTS (
          SELECT 1 FROM attendance a
          WHERE a.user_id = u.id
            AND a.date = CURDATE()
            AND a.status IN ('IN', 'OUT')
        )
        AND (
          ? = TRUE
          OR NOT EXISTS (
            SELECT 1 FROM late_checkin_reminders lr
            WHERE lr.user_id = u.id
              AND lr.reminder_date = CURDATE()
          )
        )
        AND NOT EXISTS (
          SELECT 1 FROM leave_requests l
          WHERE l.user_id = u.id
            AND l.status = 'Approved'
            AND CURDATE() BETWEEN l.from_date AND l.to_date
        )`,
      [Boolean(isManualTest)]
    );

    if (eligibleUsers.length === 0) {
      console.log('[Attendance Cron] No pending employees found for Late Alert (all checked in, alerted, or on leave).');
      return { success: true, count: 0, message: 'No pending employees to alert' };
    }

    console.log(`[Attendance Cron] Preparing Late Punch-in Alert for ${eligibleUsers.length} employee(s)...`);

    // Prepare push notification messages
    const pushMessages = eligibleUsers.map((user) => ({
      to: user.push_token,
      sound: 'default',
      priority: 'high',
      channelId: 'default',
      categoryId: 'attendance_reminder',
      title: 'Late Punch-in Alert',
      body: `Good morning ${user.name}! Office started at 10:00 AM and you have not checked in yet. Please punch in immediately.`,
      data: {
        type: 'LATE_CHECKIN_ALERT',
        officeStartTime: '10:00 AM',
        target: 'PunchIn',
      },
    }));

    // Send via Expo Push Gateway
    const result = await sendExpoPushNotifications(pushMessages);

    // Record in late_checkin_reminders to prevent duplicate alerts (real cron only, not test)
    if (!isManualTest) {
      for (const user of eligibleUsers) {
        try {
          await pool.query(
            `INSERT INTO late_checkin_reminders (user_id, reminder_date)
             VALUES (?, CURDATE())
             ON DUPLICATE KEY UPDATE sent_at = CURRENT_TIMESTAMP`,
            [user.id]
          );
        } catch (_recErr) { }
      }
    }

    console.log(`[Attendance Cron] Successfully sent Late Punch-in Alerts to ${eligibleUsers.length} employee(s).`);

    return {
      success: true,
      count: eligibleUsers.length,
      employees: eligibleUsers.map((u) => u.name),
      expoResult: result,
    };
  } catch (error) {
    console.error('[Attendance Cron] Error executing late reminder job:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Initialize the scheduled cron jobs:
 * 1. Mon-Sat 09:45 AM: 15-minute advance reminder
 * 2. Mon-Sat 10:05 AM: Late check-in alert if not punched in yet
 */
function initializeAttendanceCron() {
  // 1. Cron schedule: 9:45 AM, Monday to Saturday (15m before office start)
  cron.schedule('45 9 * * 1-6', async () => {
    console.log('[Attendance Cron] ⏰ 09:45 AM trigger fired: Running check-in reminder job...');
    await runAttendanceReminderJob(false);
  });

  // 2. Cron schedule: 10:05 AM, Monday to Saturday (Late check-in alert if not punched in)
  cron.schedule('5 10 * * 1-6', async () => {
    console.log('[Attendance Cron] ⚠️ 10:05 AM trigger fired: Running late check-in alert job...');
    await runLateAttendanceReminderJob(false);
  });

  console.log('⏰ Attendance Crons initialized:');
  console.log('   • 09:45 AM (Mon-Sat): 15-min pre-checkin reminder');
  console.log('   • 10:05 AM (Mon-Sat): Late check-in alert (if not punched in)');
}

module.exports = {
  initializeAttendanceCron,
  runAttendanceReminderJob,
  runLateAttendanceReminderJob,
  sendExpoPushNotifications,
};
