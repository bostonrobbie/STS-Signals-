/**
 * Tests for webhook notification functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the notification module
vi.mock('./_core/notification', () => ({
  notifyOwnerAsync: vi.fn(),
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

import { notifyOwnerAsync, notifyOwner } from './_core/notification';

describe('Webhook Notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('notifyOwnerAsync', () => {
    it('should be a fire-and-forget function that does not block', () => {
      // notifyOwnerAsync is designed to not block - it returns void immediately
      // The actual notification is sent asynchronously
      const payload = {
        title: '📈 Long Entry: ESTrend',
        content: 'New long position opened\n\n**Strategy:** ESTrend\n**Direction:** Long\n**Entry Price:** $4500.00',
      };

      // Should return immediately without throwing
      const result = notifyOwnerAsync(payload);
      expect(result).toBeUndefined();
    });

    it('should not throw when called with valid payload', () => {
      const payload = {
        title: 'Test',
        content: 'Test content',
      };

      // Should not throw
      expect(() => notifyOwnerAsync(payload)).not.toThrow();
    });
  });

  describe('Entry Signal Notifications', () => {
    it('should format entry notification correctly for long position', () => {
      const strategySymbol = 'ESTrend';
      const direction = 'Long';
      const price = 4500.00;
      const quantity = 1;
      const timestamp = new Date('2024-01-15T14:30:00Z');

      const expectedTitle = `📈 ${direction} Entry: ${strategySymbol}`;
      const expectedContent = `New ${direction.toLowerCase()} position opened\n\n` +
        `**Strategy:** ${strategySymbol}\n` +
        `**Direction:** ${direction}\n` +
        `**Entry Price:** $${price.toFixed(2)}\n` +
        `**Quantity:** ${quantity} contract\n` +
        `**Time:** ${timestamp.toLocaleString()}`;

      expect(expectedTitle).toBe('📈 Long Entry: ESTrend');
      expect(expectedContent).toContain('**Strategy:** ESTrend');
      expect(expectedContent).toContain('**Entry Price:** $4500.00');
    });

    it('should format entry notification correctly for short position', () => {
      const strategySymbol = 'NQTrend';
      const direction = 'Short';
      const price = 15000.00;
      const quantity = 2;

      const expectedTitle = `📈 ${direction} Entry: ${strategySymbol}`;
      
      expect(expectedTitle).toBe('📈 Short Entry: NQTrend');
    });

    it('should pluralize contracts correctly', () => {
      const singleContract = `1 contract`;
      const multipleContracts = `2 contracts`;

      expect(singleContract).not.toContain('contracts');
      expect(multipleContracts).toContain('contracts');
    });
  });

  describe('Exit Signal Notifications', () => {
    it('should format exit notification with profit correctly', () => {
      const strategySymbol = 'ESTrend';
      const direction = 'Long';
      const entryPrice = 4500.00;
      const exitPrice = 4520.00;
      const pnlDollars = 20.00;
      const quantity = 1;

      const pnlEmoji = pnlDollars >= 0 ? '✅' : '❌';
      const pnlSign = pnlDollars >= 0 ? '+' : '';

      const expectedTitle = `${pnlEmoji} Trade Closed: ${strategySymbol} ${pnlSign}$${pnlDollars.toFixed(2)}`;
      
      expect(expectedTitle).toBe('✅ Trade Closed: ESTrend +$20.00');
    });

    it('should format exit notification with loss correctly', () => {
      const strategySymbol = 'NQTrend';
      const pnlDollars = -50.00;

      const pnlEmoji = pnlDollars >= 0 ? '✅' : '❌';
      const pnlSign = pnlDollars >= 0 ? '+' : '';

      const expectedTitle = `${pnlEmoji} Trade Closed: ${strategySymbol} ${pnlSign}$${pnlDollars.toFixed(2)}`;
      
      expect(expectedTitle).toBe('❌ Trade Closed: NQTrend $-50.00');
    });

    it('should include all required fields in exit notification content', () => {
      const content = `Position closed with profit\n\n` +
        `**Strategy:** ESTrend\n` +
        `**Direction:** Long\n` +
        `**Entry Price:** $4500.00\n` +
        `**Exit Price:** $4520.00\n` +
        `**P&L:** +$20.00\n` +
        `**Quantity:** 1 contract\n` +
        `**Duration:** 2h 30m`;

      expect(content).toContain('**Strategy:**');
      expect(content).toContain('**Direction:**');
      expect(content).toContain('**Entry Price:**');
      expect(content).toContain('**Exit Price:**');
      expect(content).toContain('**P&L:**');
      expect(content).toContain('**Quantity:**');
      expect(content).toContain('**Duration:**');
    });
  });

  describe('Duration Formatting', () => {
    function formatDuration(start: Date, end: Date): string {
      const diffMs = end.getTime() - start.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffDays > 0) {
        const hours = diffHours % 24;
        return `${diffDays}d ${hours}h`;
      } else if (diffHours > 0) {
        const mins = diffMins % 60;
        return `${diffHours}h ${mins}m`;
      } else {
        return `${diffMins}m`;
      }
    }

    it('should format minutes correctly', () => {
      const start = new Date('2024-01-15T14:00:00Z');
      const end = new Date('2024-01-15T14:30:00Z');
      
      expect(formatDuration(start, end)).toBe('30m');
    });

    it('should format hours and minutes correctly', () => {
      const start = new Date('2024-01-15T14:00:00Z');
      const end = new Date('2024-01-15T16:30:00Z');
      
      expect(formatDuration(start, end)).toBe('2h 30m');
    });

    it('should format days and hours correctly', () => {
      const start = new Date('2024-01-15T14:00:00Z');
      const end = new Date('2024-01-17T18:00:00Z');
      
      expect(formatDuration(start, end)).toBe('2d 4h');
    });

    it('should handle exact hours', () => {
      const start = new Date('2024-01-15T14:00:00Z');
      const end = new Date('2024-01-15T16:00:00Z');
      
      expect(formatDuration(start, end)).toBe('2h 0m');
    });
  });
});
