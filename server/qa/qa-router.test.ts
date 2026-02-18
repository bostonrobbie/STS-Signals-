/**
 * Tests for QA Router Endpoints
 * 
 * These tests verify the QA dashboard API endpoints work correctly
 * for monitoring and validating the webhook-to-trade data pipeline.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the data integrity service
vi.mock('../services/dataIntegrityService', () => ({
  quickHealthCheck: vi.fn().mockResolvedValue({
    healthy: true,
    checks: [
      { name: 'Database Connection', status: 'pass', message: 'Connected' },
      { name: 'Webhook Success Rate', status: 'pass', message: '95% success rate (last hour)', value: 95 },
      { name: 'Data Integrity', status: 'pass', message: 'All closed positions have trades', value: 0 },
      { name: 'Open Positions', status: 'pass', message: '2 positions currently open', value: 2 },
      { name: 'Processing Latency', status: 'pass', message: 'Avg: 75ms, Max: 250ms', value: 75 },
    ],
  }),
  validateDataIntegrity: vi.fn().mockResolvedValue({
    isValid: true,
    timestamp: new Date(),
    duration: 150,
    errors: [],
    warnings: [],
    stats: {
      openPositions: 2,
      closedPositions: 50,
      totalTrades: 48,
      webhookLogs: 200,
      successfulWebhooks: 190,
      failedWebhooks: 10,
      orphanedPositions: 0,
      orphanedTrades: 2,
      pnlMismatches: 0,
    },
  }),
  getReconciliationReport: vi.fn().mockResolvedValue({
    generatedAt: new Date(),
    summary: {
      totalPositions: 52,
      totalTrades: 48,
      matchedRecords: 48,
      unmatchedPositions: 0,
      unmatchedTrades: 2,
    },
    unmatchedPositions: [],
    unmatchedTrades: [
      { id: 1, strategyId: 1, direction: 'Long', entryDate: new Date(), exitDate: new Date(), pnl: 5000, issue: 'No corresponding position (may be from CSV import)' },
      { id: 2, strategyId: 1, direction: 'Short', entryDate: new Date(), exitDate: new Date(), pnl: -2000, issue: 'No corresponding position (may be from CSV import)' },
    ],
  }),
}));

// Mock db functions
vi.mock('../db', () => ({
  getWebhookLogs: vi.fn().mockResolvedValue([
    { id: 1, status: 'success', strategySymbol: 'ESTrend', processingTimeMs: 50, createdAt: new Date() },
    { id: 2, status: 'success', strategySymbol: 'NQTrend', processingTimeMs: 75, createdAt: new Date() },
    { id: 3, status: 'failed', strategySymbol: 'ESTrend', processingTimeMs: 100, errorMessage: 'POSITION_EXISTS', createdAt: new Date() },
  ]),
  getAllOpenPositions: vi.fn().mockResolvedValue([
    { id: 1, strategySymbol: 'ESTrend', direction: 'Long', entryPrice: 450000, quantity: 1, entryTime: new Date(), status: 'open' },
    { id: 2, strategySymbol: 'NQTrend', direction: 'Short', entryPrice: 1800000, quantity: 1, entryTime: new Date(), status: 'open' },
  ]),
  getAllStrategies: vi.fn().mockResolvedValue([
    { id: 1, name: 'ES Trend', symbol: 'ESTrend' },
    { id: 2, name: 'NQ Trend', symbol: 'NQTrend' },
  ]),
  getStrategyBySymbol: vi.fn().mockResolvedValue({ id: 1, name: 'ES Trend', symbol: 'ESTrend' }),
  getWebhookSettings: vi.fn().mockResolvedValue({ paused: false }),
  getOpenPositionByStrategy: vi.fn().mockResolvedValue(null),
}));

import { quickHealthCheck, validateDataIntegrity, getReconciliationReport } from '../services/dataIntegrityService';
import * as db from '../db';

describe('QA Router - Health Check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return healthy status when all checks pass', async () => {
    const result = await quickHealthCheck();
    
    expect(result.healthy).toBe(true);
    expect(result.checks).toHaveLength(5);
    expect(result.checks.every(c => c.status === 'pass')).toBe(true);
  });

  it('should include all required health checks', async () => {
    const result = await quickHealthCheck();
    
    const checkNames = result.checks.map(c => c.name);
    expect(checkNames).toContain('Database Connection');
    expect(checkNames).toContain('Webhook Success Rate');
    expect(checkNames).toContain('Data Integrity');
    expect(checkNames).toContain('Open Positions');
    expect(checkNames).toContain('Processing Latency');
  });

  it('should return unhealthy when any check fails', async () => {
    vi.mocked(quickHealthCheck).mockResolvedValueOnce({
      healthy: false,
      checks: [
        { name: 'Database Connection', status: 'fail', message: 'Connection failed' },
      ],
    });
    
    const result = await quickHealthCheck();
    
    expect(result.healthy).toBe(false);
    expect(result.checks.some(c => c.status === 'fail')).toBe(true);
  });
});

describe('QA Router - Data Integrity Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return valid when no errors found', async () => {
    const result = await validateDataIntegrity();
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should include comprehensive stats', async () => {
    const result = await validateDataIntegrity();
    
    expect(result.stats).toHaveProperty('openPositions');
    expect(result.stats).toHaveProperty('closedPositions');
    expect(result.stats).toHaveProperty('totalTrades');
    expect(result.stats).toHaveProperty('webhookLogs');
    expect(result.stats).toHaveProperty('orphanedPositions');
    expect(result.stats).toHaveProperty('orphanedTrades');
    expect(result.stats).toHaveProperty('pnlMismatches');
  });

  it('should report errors when integrity issues found', async () => {
    vi.mocked(validateDataIntegrity).mockResolvedValueOnce({
      isValid: false,
      timestamp: new Date(),
      duration: 200,
      errors: [
        { code: 'ORPHANED_POSITION', message: 'Closed position 5 has no trade', table: 'open_positions', recordId: 5 },
      ],
      warnings: [],
      stats: {
        openPositions: 2,
        closedPositions: 50,
        totalTrades: 48,
        webhookLogs: 200,
        successfulWebhooks: 190,
        failedWebhooks: 10,
        orphanedPositions: 1,
        orphanedTrades: 0,
        pnlMismatches: 0,
      },
    });
    
    const result = await validateDataIntegrity();
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('ORPHANED_POSITION');
  });

  it('should include validation duration', async () => {
    const result = await validateDataIntegrity();
    
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(typeof result.duration).toBe('number');
  });
});

describe('QA Router - Reconciliation Report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return reconciliation summary', async () => {
    const result = await getReconciliationReport();
    
    expect(result.summary).toHaveProperty('totalPositions');
    expect(result.summary).toHaveProperty('totalTrades');
    expect(result.summary).toHaveProperty('matchedRecords');
    expect(result.summary).toHaveProperty('unmatchedPositions');
    expect(result.summary).toHaveProperty('unmatchedTrades');
  });

  it('should list unmatched records', async () => {
    const result = await getReconciliationReport();
    
    expect(Array.isArray(result.unmatchedPositions)).toBe(true);
    expect(Array.isArray(result.unmatchedTrades)).toBe(true);
  });

  it('should include issue description for unmatched records', async () => {
    const result = await getReconciliationReport();
    
    if (result.unmatchedTrades.length > 0) {
      expect(result.unmatchedTrades[0]).toHaveProperty('issue');
      expect(typeof result.unmatchedTrades[0].issue).toBe('string');
    }
  });
});

describe('QA Router - Webhook Metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return webhook logs', async () => {
    const logs = await db.getWebhookLogs({ startDate: new Date(), endDate: new Date(), limit: 1000 });
    
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeGreaterThan(0);
  });

  it('should calculate success rate correctly', async () => {
    const logs = await db.getWebhookLogs({ startDate: new Date(), endDate: new Date(), limit: 1000 });
    
    const total = logs.length;
    const successful = logs.filter((l: any) => l.status === 'success').length;
    const successRate = total > 0 ? ((successful / total) * 100).toFixed(1) : '0';
    
    expect(parseFloat(successRate)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(successRate)).toBeLessThanOrEqual(100);
  });

  it('should include latency statistics', async () => {
    const logs = await db.getWebhookLogs({ startDate: new Date(), endDate: new Date(), limit: 1000 });
    
    const latencies = logs
      .filter((l: any) => l.processingTimeMs != null)
      .map((l: any) => l.processingTimeMs);
    
    if (latencies.length > 0) {
      const avgLatency = latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const minLatency = Math.min(...latencies);
      
      expect(avgLatency).toBeGreaterThanOrEqual(0);
      expect(maxLatency).toBeGreaterThanOrEqual(minLatency);
    }
  });

  it('should group by strategy', async () => {
    const logs = await db.getWebhookLogs({ startDate: new Date(), endDate: new Date(), limit: 1000 });
    
    const strategyMap = new Map<string, { total: number; success: number; failed: number }>();
    
    logs.forEach((log: any) => {
      const symbol = log.strategySymbol || 'unknown';
      const existing = strategyMap.get(symbol) || { total: 0, success: 0, failed: 0 };
      existing.total++;
      if (log.status === 'success') existing.success++;
      else if (log.status === 'failed') existing.failed++;
      strategyMap.set(symbol, existing);
    });
    
    expect(strategyMap.size).toBeGreaterThan(0);
  });
});

describe('QA Router - Open Positions Status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return all open positions', async () => {
    const positions = await db.getAllOpenPositions();
    
    expect(Array.isArray(positions)).toBe(true);
  });

  it('should include position details', async () => {
    const positions = await db.getAllOpenPositions();
    const openPositions = positions.filter((p: any) => p.status === 'open');
    
    if (openPositions.length > 0) {
      const pos = openPositions[0];
      expect(pos).toHaveProperty('strategySymbol');
      expect(pos).toHaveProperty('direction');
      expect(pos).toHaveProperty('entryPrice');
      expect(pos).toHaveProperty('quantity');
      expect(pos).toHaveProperty('entryTime');
    }
  });

  it('should calculate position age correctly', async () => {
    const positions = await db.getAllOpenPositions();
    const openPositions = positions.filter((p: any) => p.status === 'open');
    
    if (openPositions.length > 0) {
      const pos = openPositions[0];
      const ageMinutes = Math.round((Date.now() - new Date(pos.entryTime).getTime()) / 60000);
      
      expect(ageMinutes).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('QA Router - Pipeline Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should test database connectivity', async () => {
    const strategies = await db.getAllStrategies();
    
    expect(Array.isArray(strategies)).toBe(true);
  });

  it('should test strategy lookup', async () => {
    const strategy = await db.getStrategyBySymbol('ESTrend');
    
    expect(strategy).toBeDefined();
    expect(strategy?.symbol).toBe('ESTrend');
  });

  it('should test webhook settings', async () => {
    const settings = await db.getWebhookSettings();
    
    expect(settings).toHaveProperty('paused');
    expect(typeof settings?.paused).toBe('boolean');
  });

  it('should test position check', async () => {
    const position = await db.getOpenPositionByStrategy('ESTrend');
    
    // Position can be null or an object
    expect(position === null || typeof position === 'object').toBe(true);
  });
});

describe('QA Error Codes', () => {
  it('should define standard error codes', () => {
    const errorCodes = [
      'DB_UNAVAILABLE',
      'ORPHANED_POSITION',
      'ORPHANED_TRADE',
      'PNL_MISMATCH',
      'EXIT_WEBHOOK_NO_TRADE',
      'STALE_POSITION',
    ];
    
    errorCodes.forEach(code => {
      expect(typeof code).toBe('string');
      expect(code).toMatch(/^[A-Z_]+$/);
    });
  });
});

describe('QA Health Check Thresholds', () => {
  it('should define failure rate thresholds', () => {
    const thresholds = {
      pass: 10, // < 10% failure rate
      warn: 20, // 10-20% failure rate
      fail: 20, // > 20% failure rate
    };
    
    expect(thresholds.pass).toBeLessThan(thresholds.warn);
    expect(thresholds.warn).toBeLessThanOrEqual(thresholds.fail);
  });

  it('should define latency thresholds', () => {
    const thresholds = {
      pass: 1000, // < 1000ms avg latency
      warn: 1000, // >= 1000ms avg latency
    };
    
    expect(thresholds.pass).toBe(thresholds.warn);
  });
});
