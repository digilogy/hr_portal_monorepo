import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5s', target: 50 },   // Ramp-up to 50 VUs
    { duration: '10s', target: 200 }, // Ramp-up to 200 VUs
    { duration: '10s', target: 500 }, // Peak load 500 VUs (simulating 10,000 active users)
    { duration: '5s', target: 0 },    // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'], // 95% of requests must complete below 300ms
    http_req_failed: ['rate<0.05'],    // Error rate must be below 5%
  },
};

const BASE_URL = 'http://localhost:5111';

export default function () {
  const jsonHeaders = { 'Content-Type': 'application/json' };

  // 1. Auth: Login API
  const loginPayload = JSON.stringify({
    email: 'admin@casagrand.co.in',
    pin: '1234',
  });

  const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, { headers: jsonHeaders });
  const loginOk = check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'token received': (r) => r.json('token') !== undefined,
  });

  if (loginOk && loginRes.json('token')) {
    const token = loginRes.json('token');
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    // 2. Timesheet: Get Monthly History
    const historyRes = http.get(`${BASE_URL}/api/timesheets/history?year=2026&month=9`, { headers: authHeaders });
    check(historyRes, {
      'history status is 200': (r) => r.status === 200,
    });

    // 3. Timesheet: Save Daily Entry (Concurrent Writes)
    const todayStr = new Date().toISOString().split('T')[0];
    const savePayload = JSON.stringify({
      date: todayStr,
      data: {
        projects: [
          {
            projectId: 'proj-1',
            projectName: 'HR Monorepo',
            hours: 8,
            remarks: 'Load test automated save',
          },
        ],
      },
    });

    const saveRes = http.post(`${BASE_URL}/api/timesheets/save`, savePayload, { headers: authHeaders });
    check(saveRes, {
      'save day status is 200': (r) => r.status === 200 || r.status === 201,
    });
  }

  // 4. Auth: Request OTP / Email queue test
  const otpPayload = JSON.stringify({
    email: 'admin@casagrand.co.in',
  });
  const otpRes = http.post(`${BASE_URL}/api/auth/request-access`, otpPayload, { headers: jsonHeaders });
  check(otpRes, {
    'otp status is 200': (r) => r.status === 200,
  });

  sleep(0.5);
}

