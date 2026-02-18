import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');
const requestCount = new Counter('requests');
const activeUsers = new Gauge('active_users');

// Test configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const LOGIN_EMAIL = __ENV.LOGIN_EMAIL || 'test@example.com';
const LOGIN_PASSWORD = __ENV.LOGIN_PASSWORD || 'password123';

// Test stages
export const options = {
  stages: [
    { duration: '1m', target: 10 },    // Ramp up to 10 users
    { duration: '3m', target: 50 },    // Ramp up to 50 users
    { duration: '5m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '3m', target: 50 },    // Ramp down to 50 users
    { duration: '1m', target: 0 },     // Ramp down to 0 users
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'errors': ['rate<0.1'],
  },
};

// Setup function - runs once at the beginning
export function setup() {
  console.log('Starting load test...');
  
  // Login and get auth token
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, {
    email: LOGIN_EMAIL,
    password: LOGIN_PASSWORD,
  });
  
  const token = loginRes.json('token');
  
  if (!token) {
    throw new Error('Failed to obtain authentication token');
  }
  
  return { token };
}

// Main test function
export default function (data) {
  const token = data.token;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  
  activeUsers.set(1);
  
  group('Portfolio Overview', () => {
    const res = http.get(`${BASE_URL}/api/trpc/portfolio.overview`, { headers });
    
    const success = check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
      'has portfolio data': (r) => r.json('result.data') !== undefined,
    });
    
    errorRate.add(!success);
    apiDuration.add(res.timings.duration);
    requestCount.add(1);
  });
  
  sleep(1);
  
  group('Get Strategies', () => {
    const res = http.get(`${BASE_URL}/api/trpc/strategies.list`, { headers });
    
    const success = check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
      'has strategies': (r) => r.json('result.data.length') > 0,
    });
    
    errorRate.add(!success);
    apiDuration.add(res.timings.duration);
    requestCount.add(1);
  });
  
  sleep(1);
  
  group('Get Trades', () => {
    const res = http.get(`${BASE_URL}/api/trpc/trades.get?limit=100`, { headers });
    
    const success = check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 1000ms': (r) => r.timings.duration < 1000,
      'has trades': (r) => r.json('result.data.trades.length') > 0,
    });
    
    errorRate.add(!success);
    apiDuration.add(res.timings.duration);
    requestCount.add(1);
  });
  
  sleep(1);
  
  group('Get Performance Metrics', () => {
    const res = http.get(`${BASE_URL}/api/trpc/portfolio.metrics`, { headers });
    
    const success = check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
      'has metrics': (r) => r.json('result.data') !== undefined,
    });
    
    errorRate.add(!success);
    apiDuration.add(res.timings.duration);
    requestCount.add(1);
  });
  
  sleep(2);
}

// Teardown function - runs once at the end
export function teardown(data) {
  console.log('Load test completed');
  
  // Logout
  const headers = {
    'Authorization': `Bearer ${data.token}`,
  };
  
  http.post(`${BASE_URL}/api/auth/logout`, {}, { headers });
}
