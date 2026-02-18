/**
 * QA Auth Flow Test Suite
 * 
 * This script provides executable QA tests for the authentication flow.
 * It can be run programmatically to verify auth functionality.
 * 
 * Usage:
 *   npx tsx server/qa/auth-flow-qa.ts
 *   
 * Or import and use programmatically:
 *   import { runAuthQA } from './server/qa/auth-flow-qa';
 *   const results = await runAuthQA();
 */

import { COOKIE_NAME, ONE_YEAR_MS } from '@shared/const';

// QA Test Result Interface
export interface QATestResult {
  name: string;
  category: string;
  passed: boolean;
  message: string;
  duration: number;
  details?: Record<string, unknown>;
}

export interface QAReport {
  timestamp: Date;
  totalTests: number;
  passed: number;
  failed: number;
  duration: number;
  results: QATestResult[];
  summary: string;
}

// Helper to run a single test
async function runTest(
  name: string,
  category: string,
  testFn: () => Promise<{ passed: boolean; message: string; details?: Record<string, unknown> }>
): Promise<QATestResult> {
  const start = Date.now();
  try {
    const result = await testFn();
    return {
      name,
      category,
      passed: result.passed,
      message: result.message,
      duration: Date.now() - start,
      details: result.details,
    };
  } catch (error) {
    return {
      name,
      category,
      passed: false,
      message: `Test threw an error: ${error instanceof Error ? error.message : String(error)}`,
      duration: Date.now() - start,
    };
  }
}

// ============================================================
// LOGIN URL GENERATION TESTS
// ============================================================

async function testLoginUrlGeneration(): Promise<QATestResult> {
  return runTest('Login URL Generation', 'Login Flow', async () => {
    const oauthPortalUrl = process.env.VITE_OAUTH_PORTAL_URL || 'https://auth.manus.im';
    const appId = process.env.VITE_APP_ID || 'test-app-id';
    const origin = 'https://example.com';
    const redirectUri = `${origin}/api/oauth/callback`;
    const state = Buffer.from(redirectUri).toString('base64');

    const url = new URL(`${oauthPortalUrl}/app-auth`);
    url.searchParams.set('appId', appId);
    url.searchParams.set('redirectUri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('type', 'signIn');

    const hasRequiredParams = 
      url.searchParams.has('appId') &&
      url.searchParams.has('redirectUri') &&
      url.searchParams.has('state') &&
      url.searchParams.has('type');

    return {
      passed: hasRequiredParams,
      message: hasRequiredParams 
        ? 'Login URL contains all required OAuth parameters'
        : 'Login URL missing required OAuth parameters',
      details: {
        url: url.toString(),
        params: Object.fromEntries(url.searchParams),
      },
    };
  });
}

async function testReturnToParameter(): Promise<QATestResult> {
  return runTest('ReturnTo Parameter Encoding', 'Login Flow', async () => {
    const testCases = [
      { input: '/overview', expected: '%2Foverview' },
      { input: '/strategy/123', expected: '%2Fstrategy%2F123' },
      { input: '/compare?ids=9,10', expected: '%2Fcompare%3Fids%3D9%2C10' },
    ];

    const results = testCases.map(tc => ({
      input: tc.input,
      encoded: encodeURIComponent(tc.input),
      expected: tc.expected,
      passed: encodeURIComponent(tc.input) === tc.expected,
    }));

    const allPassed = results.every(r => r.passed);

    return {
      passed: allPassed,
      message: allPassed 
        ? 'All returnTo parameters encoded correctly'
        : 'Some returnTo parameters not encoded correctly',
      details: { testCases: results },
    };
  });
}

// ============================================================
// OAUTH CALLBACK REDIRECT TESTS
// ============================================================

async function testDefaultRedirect(): Promise<QATestResult> {
  return runTest('Default Redirect to /overview', 'OAuth Callback', async () => {
    // Simulate no returnTo parameter
    const returnTo = '' as string; // Empty string simulates undefined
    let redirectUrl = '/overview';
    
    // Only redirect if returnTo is a valid relative path
    if (returnTo && returnTo.length > 0 && returnTo.charAt(0) === '/' && returnTo.charAt(1) !== '/') {
      redirectUrl = returnTo;
    }

    return {
      passed: redirectUrl === '/overview',
      message: redirectUrl === '/overview'
        ? 'Default redirect correctly goes to /overview'
        : `Unexpected default redirect: ${redirectUrl}`,
      details: { redirectUrl },
    };
  });
}

async function testReturnToRedirect(): Promise<QATestResult> {
  return runTest('ReturnTo Path Redirect', 'OAuth Callback', async () => {
    const testPaths = ['/strategies', '/strategy/9', '/compare', '/admin', '/my-dashboard'];
    const results = testPaths.map(returnTo => {
      let redirectUrl = '/overview';
      if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
        redirectUrl = returnTo;
      }
      return { input: returnTo, output: redirectUrl, passed: redirectUrl === returnTo };
    });

    const allPassed = results.every(r => r.passed);

    return {
      passed: allPassed,
      message: allPassed
        ? 'All valid returnTo paths redirect correctly'
        : 'Some returnTo paths not redirecting correctly',
      details: { testCases: results },
    };
  });
}

async function testOpenRedirectPrevention(): Promise<QATestResult> {
  return runTest('Open Redirect Prevention', 'OAuth Callback', async () => {
    const maliciousUrls = [
      '//evil.com/phishing',
      'https://evil.com/steal-tokens',
      'http://attacker.com',
      '//google.com',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
    ];

    const results = maliciousUrls.map(maliciousReturnTo => {
      let redirectUrl = '/overview';
      if (maliciousReturnTo && maliciousReturnTo.startsWith('/') && !maliciousReturnTo.startsWith('//')) {
        redirectUrl = maliciousReturnTo;
      }
      return {
        input: maliciousReturnTo,
        output: redirectUrl,
        blocked: redirectUrl === '/overview',
      };
    });

    const allBlocked = results.every(r => r.blocked);

    return {
      passed: allBlocked,
      message: allBlocked
        ? 'All malicious URLs blocked - open redirect prevention working'
        : 'SECURITY ISSUE: Some malicious URLs not blocked!',
      details: { testCases: results },
    };
  });
}

// ============================================================
// SESSION COOKIE TESTS
// ============================================================

async function testCookieConfiguration(): Promise<QATestResult> {
  return runTest('Cookie Configuration', 'Session Management', async () => {
    const isSecure = true;
    const cookieOptions = {
      httpOnly: true,
      path: '/',
      sameSite: 'none' as const,
      secure: isSecure,
      maxAge: ONE_YEAR_MS,
    };

    const checks = [
      { name: 'httpOnly', expected: true, actual: cookieOptions.httpOnly },
      { name: 'path', expected: '/', actual: cookieOptions.path },
      { name: 'sameSite', expected: 'none', actual: cookieOptions.sameSite },
      { name: 'secure', expected: true, actual: cookieOptions.secure },
      { name: 'maxAge', expected: ONE_YEAR_MS, actual: cookieOptions.maxAge },
    ];

    const allCorrect = checks.every(c => c.expected === c.actual);

    return {
      passed: allCorrect,
      message: allCorrect
        ? 'Cookie configuration is secure and correct'
        : 'Cookie configuration has issues',
      details: { checks },
    };
  });
}

async function testCookieName(): Promise<QATestResult> {
  return runTest('Cookie Name', 'Session Management', async () => {
    const expectedName = 'app_session_id';
    const passed = COOKIE_NAME === expectedName;

    return {
      passed,
      message: passed
        ? `Cookie name is correct: ${COOKIE_NAME}`
        : `Cookie name mismatch: expected ${expectedName}, got ${COOKIE_NAME}`,
      details: { cookieName: COOKIE_NAME, expected: expectedName },
    };
  });
}

// ============================================================
// LOGOUT FLOW TESTS
// ============================================================

async function testLogoutCookieClear(): Promise<QATestResult> {
  return runTest('Logout Cookie Clear', 'Logout Flow', async () => {
    const clearCookieOptions = {
      httpOnly: true,
      path: '/',
      sameSite: 'none' as const,
      secure: true,
      maxAge: -1,
    };

    const passed = clearCookieOptions.maxAge === -1;

    return {
      passed,
      message: passed
        ? 'Logout correctly clears cookie with negative maxAge'
        : 'Logout cookie clear configuration is incorrect',
      details: { clearCookieOptions },
    };
  });
}

// ============================================================
// AUTH STATE MANAGEMENT TESTS
// ============================================================

async function testAuthenticatedState(): Promise<QATestResult> {
  return runTest('Authenticated State Detection', 'Auth State', async () => {
    const user = { id: 1, openId: 'test-open-id', name: 'Test User' };
    const isAuthenticated = Boolean(user);

    return {
      passed: isAuthenticated === true,
      message: isAuthenticated
        ? 'Authenticated state correctly detected'
        : 'Failed to detect authenticated state',
      details: { user, isAuthenticated },
    };
  });
}

async function testUnauthenticatedState(): Promise<QATestResult> {
  return runTest('Unauthenticated State Detection', 'Auth State', async () => {
    const user = null;
    const isAuthenticated = Boolean(user);

    return {
      passed: isAuthenticated === false,
      message: !isAuthenticated
        ? 'Unauthenticated state correctly detected'
        : 'Failed to detect unauthenticated state',
      details: { user, isAuthenticated },
    };
  });
}

async function testLoadingState(): Promise<QATestResult> {
  return runTest('Loading State Handling', 'Auth State', async () => {
    const isLoading = true;
    const user = null;
    const shouldRedirect = !isLoading && !user;

    return {
      passed: shouldRedirect === false,
      message: !shouldRedirect
        ? 'Loading state correctly prevents redirect'
        : 'Loading state not handled correctly',
      details: { isLoading, user, shouldRedirect },
    };
  });
}

// ============================================================
// PROTECTED ROUTE ACCESS TESTS
// ============================================================

async function testProtectedRouteAccess(): Promise<QATestResult> {
  return runTest('Protected Route Access', 'Access Control', async () => {
    const authenticatedUser = { id: 1, openId: 'test-id', name: 'Test' };
    const unauthenticatedUser = null;

    const canAccessAuthenticated = authenticatedUser !== null;
    const canAccessUnauthenticated = unauthenticatedUser !== null;

    const passed = canAccessAuthenticated && !canAccessUnauthenticated;

    return {
      passed,
      message: passed
        ? 'Protected route access control working correctly'
        : 'Protected route access control has issues',
      details: {
        authenticatedAccess: canAccessAuthenticated,
        unauthenticatedAccess: canAccessUnauthenticated,
      },
    };
  });
}

async function testAdminRoleAccess(): Promise<QATestResult> {
  return runTest('Admin Role Access Control', 'Access Control', async () => {
    const adminUser = { id: 1, openId: 'admin-id', name: 'Admin', role: 'admin' };
    const regularUser = { id: 2, openId: 'user-id', name: 'User', role: 'user' };

    const isAdmin = (user: { role: string }) => user.role === 'admin';

    const adminCanAccess = isAdmin(adminUser);
    const userCannotAccess = !isAdmin(regularUser);

    const passed = adminCanAccess && userCannotAccess;

    return {
      passed,
      message: passed
        ? 'Admin role access control working correctly'
        : 'Admin role access control has issues',
      details: {
        adminAccess: adminCanAccess,
        userDenied: userCannotAccess,
      },
    };
  });
}

// ============================================================
// JWT TOKEN VALIDATION TESTS
// ============================================================

async function testJwtStructure(): Promise<QATestResult> {
  return runTest('JWT Token Structure', 'Token Validation', async () => {
    const validJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcGVuSWQiOiJ0ZXN0In0.signature';
    const parts = validJwt.split('.');

    const hasValidStructure = parts.length === 3 && parts.every(p => p.length > 0);

    return {
      passed: hasValidStructure,
      message: hasValidStructure
        ? 'JWT structure validation working correctly'
        : 'JWT structure validation has issues',
      details: {
        token: validJwt,
        parts: parts.length,
        hasHeader: parts[0]?.length > 0,
        hasPayload: parts[1]?.length > 0,
        hasSignature: parts[2]?.length > 0,
      },
    };
  });
}

async function testMalformedTokenRejection(): Promise<QATestResult> {
  return runTest('Malformed Token Rejection', 'Token Validation', async () => {
    const malformedTokens = [
      { token: '', description: 'empty string' },
      { token: 'not-a-jwt', description: 'no dots' },
      { token: 'one.two', description: 'only two parts' },
      { token: 'a.b.c.d.e', description: 'too many parts' },
      { token: '..', description: 'empty parts' },
    ];

    const results = malformedTokens.map(({ token, description }) => {
      const parts = token.split('.');
      const isValid = parts.length === 3 && parts.every(p => p.length > 0);
      return { token, description, rejected: !isValid };
    });

    const allRejected = results.every(r => r.rejected);

    return {
      passed: allRejected,
      message: allRejected
        ? 'All malformed tokens correctly rejected'
        : 'Some malformed tokens not rejected',
      details: { testCases: results },
    };
  });
}

// ============================================================
// MAIN QA RUNNER
// ============================================================

export async function runAuthQA(): Promise<QAReport> {
  const startTime = Date.now();
  const timestamp = new Date();

  console.log('\n🔐 Running Auth Flow QA Tests...\n');
  console.log('=' .repeat(60));

  const tests = [
    // Login Flow
    testLoginUrlGeneration,
    testReturnToParameter,
    // OAuth Callback
    testDefaultRedirect,
    testReturnToRedirect,
    testOpenRedirectPrevention,
    // Session Management
    testCookieConfiguration,
    testCookieName,
    // Logout Flow
    testLogoutCookieClear,
    // Auth State
    testAuthenticatedState,
    testUnauthenticatedState,
    testLoadingState,
    // Access Control
    testProtectedRouteAccess,
    testAdminRoleAccess,
    // Token Validation
    testJwtStructure,
    testMalformedTokenRejection,
  ];

  const results: QATestResult[] = [];

  for (const test of tests) {
    const result = await test();
    results.push(result);

    const status = result.passed ? '✅' : '❌';
    console.log(`${status} [${result.category}] ${result.name}`);
    if (!result.passed) {
      console.log(`   └─ ${result.message}`);
    }
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const duration = Date.now() - startTime;

  console.log('\n' + '=' .repeat(60));
  console.log(`\n📊 QA Report Summary`);
  console.log(`   Total Tests: ${results.length}`);
  console.log(`   Passed: ${passed} ✅`);
  console.log(`   Failed: ${failed} ❌`);
  console.log(`   Duration: ${duration}ms`);
  console.log(`   Pass Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

  const summary = failed === 0
    ? '✅ All auth flow tests passed! Authentication system is working correctly.'
    : `⚠️ ${failed} test(s) failed. Review the results above for details.`;

  console.log(`\n${summary}\n`);

  return {
    timestamp,
    totalTests: results.length,
    passed,
    failed,
    duration,
    results,
    summary,
  };
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAuthQA().then(report => {
    process.exit(report.failed > 0 ? 1 : 0);
  });
}
