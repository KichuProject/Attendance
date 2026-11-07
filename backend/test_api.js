const { startServer } = require('./server');

async function runTests() {
  console.log('🧪 Starting Full Backend & MySQL Integration Tests...\n');

  const baseUrl = 'http://localhost:5001/api';
  let server = null;

  try {
    const check = await fetch(`${baseUrl}/health`).catch(() => null);
    if (!check || !check.ok) {
      server = await startServer(5001);
    } else {
      console.log('📡 Connected to active backend server on port 5001\n');
    }

    // Test 1: Health check
    console.log('--- Test 1: Health Check ---');
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = await healthRes.json();
    console.log('Health status:', healthData.status);
    if (healthData.status !== 'online') throw new Error('Health check failed');
    console.log('✅ Health check passed\n');

    // Test 2: User Registration (auto emp_id)
    console.log('--- Test 2: User Registration ---');
    const testUsername = `user_${Date.now()}`;
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Tech Sigaram Employee',
        username: testUsername,
        password: 'password123',
      }),
    });
    const regData = await regRes.json();
    console.log('Registration response:', regData);
    if (!regData.success || !regData.user.empId) throw new Error('Registration failed');
    console.log('✅ Registration passed. Auto-generated Emp ID:', regData.user.empId, '\n');

    const userId = regData.user.id;

    // Test 3: Duplicate Registration Guard
    console.log('--- Test 3: Duplicate Registration Guard ---');
    const dupRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Tech Sigaram Employee',
        username: testUsername,
        password: 'password123',
      }),
    });
    const dupData = await dupRes.json();
    console.log('Duplicate response:', dupData.error);
    if (dupRes.status !== 400 || !dupData.error) throw new Error('Duplicate username was not rejected');
    console.log('✅ Duplicate username correctly rejected with 400 (Bad Request)\n');

    // Test 4: User Login
    console.log('--- Test 4: User Login ---');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testUsername,
        password: 'password123',
      }),
    });
    const loginData = await loginRes.json();
    console.log('Login response:', loginData.message, 'Token received:', !!loginData.token);
    if (!loginData.success) throw new Error('Login failed');
    console.log('✅ Login passed\n');

    // Test 5: Get Today's Status (initially NOT IN)
    console.log('--- Test 5: Get Today Attendance (Initial) ---');
    const todayRes = await fetch(`${baseUrl}/attendance/today/${userId}`);
    const todayData = await todayRes.json();
    console.log('Initial today status:', todayData.today.status);
    if (todayData.today.status !== 'NOT IN') throw new Error('Expected status to be NOT IN');
    console.log('✅ Initial status passed\n');

    // Test 6: Check-IN with Latitude & Longitude
    console.log('--- Test 6: Check-IN with GPS Coordinates ---');
    const checkInRes = await fetch(`${baseUrl}/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        inTime: '09:30 AM',
        latitude: '13.0827° N',
        longitude: '80.2707° E',
      }),
    });
    const checkInData = await checkInRes.json();
    console.log('Check-IN response:', checkInData);
    if (!checkInData.success || checkInData.data.status !== 'IN') throw new Error('Check-IN failed');
    console.log('✅ Check-IN passed\n');

    // Test 7: Prevent Duplicate Check-IN
    console.log('--- Test 7: Prevent Duplicate Check-IN ---');
    const dupCheckInRes = await fetch(`${baseUrl}/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        inTime: '09:35 AM',
      }),
    });
    const dupCheckInData = await dupCheckInRes.json();
    console.log('Duplicate check-in rejected:', dupCheckInData.error);
    if (dupCheckInRes.status !== 400) throw new Error('Duplicate check-in was not blocked');
    console.log('✅ Duplicate check-in correctly blocked\n');

    // Test 8: Check-OUT
    console.log('--- Test 8: Check-OUT ---');
    const checkOutRes = await fetch(`${baseUrl}/attendance/check-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        outTime: '06:15 PM',
      }),
    });
    const checkOutData = await checkOutRes.json();
    console.log('Check-OUT response:', checkOutData);
    if (!checkOutData.success || checkOutData.data.status !== 'OUT') throw new Error('Check-OUT failed');
    console.log('✅ Check-OUT passed\n');

    // Test 9: Attendance History & 8 Fields
    console.log('--- Test 9: Attendance History & 8 Fields Verification ---');
    const historyRes = await fetch(`${baseUrl}/attendance/history/${userId}`);
    const historyData = await historyRes.json();
    console.log('History count:', historyData.count);
    const rec = historyData.records[0];
    console.log('Latest record:', rec);

    const requiredFields = ['empId', 'name', 'date', 'status', 'inTime', 'outTime', 'latitude', 'longitude'];
    for (const field of requiredFields) {
      if (rec[field] === undefined || rec[field] === null) {
        throw new Error(`Field '${field}' is missing from attendance history record!`);
      }
    }
    console.log('✅ All 8 report modal fields verified successfully!\n');

    console.log('🎉 ALL BACKEND & MYSQL TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Test Error:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close(() => {
        console.log('Test server closed.');
        process.exit(process.exitCode || 0);
      });
    } else {
      process.exit(process.exitCode || 0);
    }
  }
}

runTests();

