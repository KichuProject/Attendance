const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { initializeDatabase } = require('./config/db');
const { initializeAttendanceCron, runAttendanceReminderJob } = require('./cron/attendanceReminderCron');
const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const leaveRoutes = require('./routes/leave');
const projectRoutes = require('./routes/project');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'Attendance Backend API',
    cronSchedule: '09:45 AM Mon-Sat (15m before 10:00 AM)',
  });
});

// Manual trigger route for instant push notification testing
app.post('/api/attendance/trigger-reminder-test', async (req, res) => {
  try {
    const result = await runAttendanceReminderJob(true);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/projects', projectRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Initialize DB and Start Server
async function startServer(port = PORT) {
  await initializeDatabase();
  initializeAttendanceCron();

  return new Promise((resolve, reject) => {
    const serverInstance = app.listen(port, '0.0.0.0', () => {
      console.log(`===============================================`);
      console.log(`🚀 Attendance Backend Server running on port ${port}`);
      console.log(`📡 Local: http://localhost:${port}`);
      console.log(`🩺 Health: http://localhost:${port}/api/health`);
      console.log(`===============================================`);
      resolve(serverInstance);
    });

    serverInstance.on('error', (err) => {
      reject(err);
    });
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };

