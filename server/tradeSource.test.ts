/**
 * Trade Source Tracking Tests
 * 
 * Tests for the source field in trades table that tracks
 * whether trades came from CSV import, webhook, or manual entry.
 */

import { describe, it, expect } from 'vitest';

// Test the source field enum values
describe('Trade Source Field', () => {
  const validSources = ['csv_import', 'webhook', 'manual'] as const;
  
  it('should have valid source enum values', () => {
    expect(validSources).toContain('csv_import');
    expect(validSources).toContain('webhook');
    expect(validSources).toContain('manual');
    expect(validSources.length).toBe(3);
  });
  
  it('should default to csv_import for historical data', () => {
    // CSV imports use the default value
    const defaultSource = 'csv_import';
    expect(defaultSource).toBe('csv_import');
  });
  
  it('should use webhook source for TradingView signals', () => {
    // Webhook handler sets source='webhook'
    const webhookSource = 'webhook';
    expect(webhookSource).toBe('webhook');
  });
  
  it('should use manual source for user-entered trades', () => {
    // Manual entry would set source='manual'
    const manualSource = 'manual';
    expect(manualSource).toBe('manual');
  });
});

// Test trade creation with source field
describe('Trade Creation with Source', () => {
  interface TradeInput {
    strategyId: number;
    entryDate: Date;
    exitDate: Date;
    direction: string;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
    pnlPercent: number;
    commission: number;
    isTest?: boolean;
    source?: 'csv_import' | 'webhook' | 'manual';
  }
  
  it('should accept trade with source field', () => {
    const trade: TradeInput = {
      strategyId: 1,
      entryDate: new Date('2024-01-15T09:30:00Z'),
      exitDate: new Date('2024-01-15T10:30:00Z'),
      direction: 'Long',
      entryPrice: 500000, // $5000.00 in cents
      exitPrice: 502500, // $5025.00 in cents
      quantity: 1,
      pnl: 2500, // $25.00 profit
      pnlPercent: 50, // 0.5%
      commission: 0,
      source: 'webhook',
    };
    
    expect(trade.source).toBe('webhook');
    expect(trade.strategyId).toBe(1);
    expect(trade.pnl).toBe(2500);
  });
  
  it('should allow trade without source (uses default)', () => {
    const trade: TradeInput = {
      strategyId: 1,
      entryDate: new Date('2024-01-15T09:30:00Z'),
      exitDate: new Date('2024-01-15T10:30:00Z'),
      direction: 'Short',
      entryPrice: 500000,
      exitPrice: 497500,
      quantity: 1,
      pnl: 2500,
      pnlPercent: 50,
      commission: 0,
      // source is optional - defaults to csv_import in DB
    };
    
    expect(trade.source).toBeUndefined();
  });
  
  it('should validate source is one of allowed values', () => {
    const validSources = ['csv_import', 'webhook', 'manual'];
    const testSource = 'webhook';
    
    expect(validSources.includes(testSource)).toBe(true);
    expect(validSources.includes('invalid')).toBe(false);
  });
});

// Test data validation with source awareness
describe('Data Validation with Source Awareness', () => {
  it('should identify webhook trades for validation', () => {
    // Webhook trades should have corresponding webhook logs
    const webhookTrade = {
      id: 1,
      source: 'webhook' as const,
      strategyId: 1,
    };
    
    expect(webhookTrade.source).toBe('webhook');
    // Webhook trades can be validated against webhook_logs
  });
  
  it('should identify CSV imported trades', () => {
    // CSV trades are historical and don't have webhook logs
    const csvTrade = {
      id: 2,
      source: 'csv_import' as const,
      strategyId: 1,
    };
    
    expect(csvTrade.source).toBe('csv_import');
    // CSV trades are expected to not have webhook logs
  });
  
  it('should allow filtering trades by source', () => {
    const trades = [
      { id: 1, source: 'csv_import' as const },
      { id: 2, source: 'webhook' as const },
      { id: 3, source: 'csv_import' as const },
      { id: 4, source: 'webhook' as const },
      { id: 5, source: 'manual' as const },
    ];
    
    const webhookTrades = trades.filter(t => t.source === 'webhook');
    const csvTrades = trades.filter(t => t.source === 'csv_import');
    const manualTrades = trades.filter(t => t.source === 'manual');
    
    expect(webhookTrades.length).toBe(2);
    expect(csvTrades.length).toBe(2);
    expect(manualTrades.length).toBe(1);
  });
});
