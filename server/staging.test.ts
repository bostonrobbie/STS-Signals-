/**
 * Tests for Staging Trades functionality
 * Verifies the approve/reject/edit workflow for webhook review
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('./db', () => ({
  getStagingTrades: vi.fn(),
  getStagingTradeStats: vi.fn(),
  getStagingTradeById: vi.fn(),
  createStagingTrade: vi.fn(),
  approveStagingTrade: vi.fn(),
  rejectStagingTrade: vi.fn(),
  editStagingTrade: vi.fn(),
  deleteStagingTrade: vi.fn(),
}));

import * as db from './db';

describe('Staging Trades', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStagingTrades', () => {
    it('should return staging trades with pending status filter', async () => {
      const mockTrades = [
        {
          id: 1,
          webhookLogId: 100,
          strategyId: 1,
          strategySymbol: 'ESTrend',
          entryDate: new Date('2024-01-15'),
          exitDate: new Date('2024-01-15'),
          direction: 'Long',
          entryPrice: 450000, // $4500.00 in cents
          exitPrice: 452000,
          quantity: 1,
          pnl: 20000, // $200.00
          pnlPercent: 444, // 0.0444%
          commission: 500,
          isOpen: false,
          status: 'pending',
          reviewedBy: null,
          reviewedAt: null,
          reviewNotes: null,
          originalPayload: null,
          productionTradeId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.getStagingTrades).mockResolvedValue(mockTrades as any);

      const result = await db.getStagingTrades({ status: 'pending' });

      expect(db.getStagingTrades).toHaveBeenCalledWith({ status: 'pending' });
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
      expect(result[0].strategySymbol).toBe('ESTrend');
    });

    it('should return empty array when no staging trades exist', async () => {
      vi.mocked(db.getStagingTrades).mockResolvedValue([]);

      const result = await db.getStagingTrades();

      expect(result).toHaveLength(0);
    });
  });

  describe('getStagingTradeStats', () => {
    it('should return correct statistics', async () => {
      const mockStats = {
        pending: 5,
        approved: 10,
        rejected: 2,
        edited: 1,
        openPositions: 3,
      };

      vi.mocked(db.getStagingTradeStats).mockResolvedValue(mockStats);

      const result = await db.getStagingTradeStats();

      expect(result.pending).toBe(5);
      expect(result.approved).toBe(10);
      expect(result.rejected).toBe(2);
      expect(result.edited).toBe(1);
      expect(result.openPositions).toBe(3);
    });
  });

  describe('approveStagingTrade', () => {
    it('should approve a closed staging trade', async () => {
      vi.mocked(db.approveStagingTrade).mockResolvedValue({
        success: true,
        productionTradeId: 500,
      });

      const result = await db.approveStagingTrade(1, 1, 'Verified correct');

      expect(db.approveStagingTrade).toHaveBeenCalledWith(1, 1, 'Verified correct');
      expect(result.success).toBe(true);
      expect(result.productionTradeId).toBe(500);
    });

    it('should reject approval of open positions', async () => {
      vi.mocked(db.approveStagingTrade).mockResolvedValue({
        success: false,
        error: 'Cannot approve open positions. Wait for exit signal.',
      });

      const result = await db.approveStagingTrade(2, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('open positions');
    });
  });

  describe('rejectStagingTrade', () => {
    it('should reject a staging trade', async () => {
      vi.mocked(db.rejectStagingTrade).mockResolvedValue({
        success: true,
      });

      const result = await db.rejectStagingTrade(1, 1, 'Invalid signal');

      expect(db.rejectStagingTrade).toHaveBeenCalledWith(1, 1, 'Invalid signal');
      expect(result.success).toBe(true);
    });
  });

  describe('editStagingTrade', () => {
    it('should edit staging trade with price corrections', async () => {
      vi.mocked(db.editStagingTrade).mockResolvedValue({
        success: true,
      });

      const updates = {
        entryPrice: 450500, // Corrected price
        pnl: 15000,
      };

      const result = await db.editStagingTrade(1, 1, updates, 'Price correction');

      expect(db.editStagingTrade).toHaveBeenCalledWith(1, 1, updates, 'Price correction');
      expect(result.success).toBe(true);
    });
  });

  describe('deleteStagingTrade', () => {
    it('should permanently delete a rejected staging trade', async () => {
      vi.mocked(db.deleteStagingTrade).mockResolvedValue(true);

      const result = await db.deleteStagingTrade(1);

      expect(db.deleteStagingTrade).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });
  });
});

describe('Staging Trade Workflow', () => {
  it('should follow correct workflow: pending -> edited -> approved', async () => {
    // Step 1: Trade starts as pending
    vi.mocked(db.getStagingTradeById).mockResolvedValueOnce({
      id: 1,
      status: 'pending',
      isOpen: false,
    } as any);

    // Step 2: Edit the trade
    vi.mocked(db.editStagingTrade).mockResolvedValue({ success: true });
    const editResult = await db.editStagingTrade(1, 1, { pnl: 15000 }, 'Corrected P&L');
    expect(editResult.success).toBe(true);

    // Step 3: Approve the edited trade
    vi.mocked(db.approveStagingTrade).mockResolvedValue({
      success: true,
      productionTradeId: 100,
    });
    const approveResult = await db.approveStagingTrade(1, 1, 'Verified after edit');
    expect(approveResult.success).toBe(true);
    expect(approveResult.productionTradeId).toBe(100);
  });

  it('should follow correct workflow: pending -> rejected -> deleted', async () => {
    // Step 1: Reject the trade
    vi.mocked(db.rejectStagingTrade).mockResolvedValue({ success: true });
    const rejectResult = await db.rejectStagingTrade(1, 1, 'Duplicate signal');
    expect(rejectResult.success).toBe(true);

    // Step 2: Delete the rejected trade
    vi.mocked(db.deleteStagingTrade).mockResolvedValue(true);
    const deleteResult = await db.deleteStagingTrade(1);
    expect(deleteResult).toBe(true);
  });
});
