const http = require('http');

const BASE_URL = 'http://localhost:5111';
const TOTAL_USERS = 500;

function httpRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', (err) => reject(err));
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runBenchmark() {
  console.log('🚀 Starting Full Load & Stress Test (500 Concurrent Operations)...');
  const startTime = Date.now();

  // 1. Auth Login Test
  const loginOpts = {
    hostname: 'localhost',
    port: 5111,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  };

  const loginRes = await httpRequest(loginOpts, { email: 'admin@casagrand.co.in', pin: '1234' });
  console.log(`✅ 1. Login API Status: ${loginRes.status}`);

  const token = loginRes.body?.token;
  if (!token) {
    console.log('⚠️ Could not obtain JWT token, skipping authenticated tests.');
    return;
  }

  // 2. Concurrent Timesheet History Reads (500 Parallel Requests)
  console.log('\n📊 2. Testing 500 Concurrent Timesheet History Reads...');
  const readStart = Date.now();
  const readPromises = Array.from({ length: TOTAL_USERS }, () =>
    httpRequest({
      hostname: 'localhost',
      port: 5111,
      path: '/api/timesheets/history?year=2026&month=9',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })
  );

  const readResults = await Promise.all(readPromises);
  const readDuration = Date.now() - readStart;
  const readSuccess = readResults.filter((r) => r.status === 200).length;
  console.log(`✅ 500 Read Requests Finished in ${readDuration}ms | Success Rate: ${readSuccess}/${TOTAL_USERS} | Avg Latency: ${(readDuration / TOTAL_USERS).toFixed(2)}ms`);

  // 3. Concurrent Timesheet Daily Writes (500 Parallel Saves)
  console.log('\n📝 3. Testing 500 Concurrent Daily Timesheet Writes...');
  const writeStart = Date.now();
  const todayStr = new Date().toISOString().split('T')[0];
  const writePromises = Array.from({ length: TOTAL_USERS }, (_, i) =>
    httpRequest(
      {
        hostname: 'localhost',
        port: 5111,
        path: '/api/timesheets/save',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      },
      {
        date: todayStr,
        slots: [
          {
            timeSlot: '09:00 - 10:00',
            activity: `Automated concurrent load test entry #${i}`,
            projectId: `proj-${i % 5}`,
          },
        ],
      }
    )
  );

  const writeResults = await Promise.all(writePromises);
  const writeDuration = Date.now() - writeStart;
  const writeSuccess = writeResults.filter((r) => r.status === 200 || r.status === 201).length;
  console.log(`✅ 500 Write Requests Finished in ${writeDuration}ms | Success Rate: ${writeSuccess}/${TOTAL_USERS} | Avg Latency: ${(writeDuration / TOTAL_USERS).toFixed(2)}ms`);
  if (writeSuccess < TOTAL_USERS) {
    console.log(`🔍 Sample Write Error (Status ${writeResults[0].status}):`, writeResults[0].body);
  }

  // 4. Concurrent OTP Enqueues (500 Parallel OTP Requests)
  console.log('\n📧 4. Testing 500 Concurrent Email OTP Enqueues...');
  const otpStart = Date.now();
  const otpPromises = Array.from({ length: TOTAL_USERS }, () =>
    httpRequest(
      {
        hostname: 'localhost',
        port: 5111,
        path: '/api/auth/request-access',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { email: 'admin@casagrand.co.in' }
    )
  );

  const otpResults = await Promise.all(otpPromises);
  const otpDuration = Date.now() - otpStart;
  const otpSuccess = otpResults.filter((r) => r.status === 200).length;
  console.log(`✅ 500 OTP Enqueues Finished in ${otpDuration}ms | Success Rate: ${otpSuccess}/${TOTAL_USERS} | Avg Latency: ${(otpDuration / TOTAL_USERS).toFixed(2)}ms`);

  const totalTime = Date.now() - startTime;
  console.log(`\n🎉 Full Multi-Scenario Load Test Completed in ${(totalTime / 1000).toFixed(2)}s!`);
}

runBenchmark().catch(console.error);
