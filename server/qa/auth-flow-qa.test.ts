/**
 * Auth Flow QA Test Suite (Vitest)
 * 
 * This wraps the QA tests in Vitest format for integration with the main test suite.
 */

import { describe, it, expect } from 'vitest';
import { runAuthQA, QAReport } from './auth-flow-qa';

describe('Auth Flow QA Suite', () => {
  let report: QAReport;

  it('should run all QA tests successfully', async () => {
    report = await runAuthQA();
    
    expect(report.totalTests).toBeGreaterThan(0);
    expect(report.timestamp).toBeInstanceOf(Date);
    expect(report.duration).toBeGreaterThan(0);
  });

  it('should have all tests pass', async () => {
    if (!report) {
      report = await runAuthQA();
    }
    
    expect(report.failed).toBe(0);
    expect(report.passed).toBe(report.totalTests);
  });

  it('should cover login flow tests', async () => {
    if (!report) {
      report = await runAuthQA();
    }
    
    const loginFlowTests = report.results.filter(r => r.category === 'Login Flow');
    expect(loginFlowTests.length).toBeGreaterThan(0);
    expect(loginFlowTests.every(t => t.passed)).toBe(true);
  });

  it('should cover OAuth callback tests', async () => {
    if (!report) {
      report = await runAuthQA();
    }
    
    const oauthTests = report.results.filter(r => r.category === 'OAuth Callback');
    expect(oauthTests.length).toBeGreaterThan(0);
    expect(oauthTests.every(t => t.passed)).toBe(true);
  });

  it('should cover session management tests', async () => {
    if (!report) {
      report = await runAuthQA();
    }
    
    const sessionTests = report.results.filter(r => r.category === 'Session Management');
    expect(sessionTests.length).toBeGreaterThan(0);
    expect(sessionTests.every(t => t.passed)).toBe(true);
  });

  it('should cover access control tests', async () => {
    if (!report) {
      report = await runAuthQA();
    }
    
    const accessTests = report.results.filter(r => r.category === 'Access Control');
    expect(accessTests.length).toBeGreaterThan(0);
    expect(accessTests.every(t => t.passed)).toBe(true);
  });

  it('should cover token validation tests', async () => {
    if (!report) {
      report = await runAuthQA();
    }
    
    const tokenTests = report.results.filter(r => r.category === 'Token Validation');
    expect(tokenTests.length).toBeGreaterThan(0);
    expect(tokenTests.every(t => t.passed)).toBe(true);
  });

  it('should verify open redirect prevention', async () => {
    if (!report) {
      report = await runAuthQA();
    }
    
    const openRedirectTest = report.results.find(r => r.name === 'Open Redirect Prevention');
    expect(openRedirectTest).toBeDefined();
    expect(openRedirectTest?.passed).toBe(true);
    
    // Verify the details show all malicious URLs were blocked
    const details = openRedirectTest?.details as { testCases: Array<{ blocked: boolean }> } | undefined;
    if (details?.testCases) {
      expect(details.testCases.every(tc => tc.blocked)).toBe(true);
    }
  });

  it('should verify default redirect goes to /overview', async () => {
    if (!report) {
      report = await runAuthQA();
    }
    
    const defaultRedirectTest = report.results.find(r => r.name === 'Default Redirect to /overview');
    expect(defaultRedirectTest).toBeDefined();
    expect(defaultRedirectTest?.passed).toBe(true);
    
    const details = defaultRedirectTest?.details as { redirectUrl: string } | undefined;
    expect(details?.redirectUrl).toBe('/overview');
  });
});
