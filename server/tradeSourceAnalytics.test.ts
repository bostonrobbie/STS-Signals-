/**
 * Trade Source Analytics Tests
 *
 * Tests the trade source breakdown and webhook performance analytics
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

describe("TradeSourceAnalytics", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getTradeSourceBreakdown", () => {
    it("should return empty breakdown when no database connection", async () => {
      const { getDb } = await import("./db");
      vi.mocked(getDb).mockResolvedValue(null);

      const { getTradeSourceBreakdown } = await import(
        "./tradeSourceAnalytics"
      );
      const result = await getTradeSourceBreakdown({});

      expect(result.breakdown).toEqual([]);
      expect(result.totalTrades).toBe(0);
      expect(result.sourceDistribution).toEqual([]);
    });

    it("should calculate correct breakdown metrics", async () => {
      // Mock database with sample data
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue([
                {
                  source: "csv_import",
                  tradeCount: 100,
                  totalPnL: 500000, // $5000 in cents
                  winCount: 60,
                  lossCount: 40,
                  totalWins: 800000, // $8000 in cents
                  totalLosses: 300000, // $3000 in cents
                  firstTradeDate: new Date("2020-01-01"),
                  lastTradeDate: new Date("2024-12-01"),
                },
                {
                  source: "webhook",
                  tradeCount: 50,
                  totalPnL: 250000, // $2500 in cents
                  winCount: 30,
                  lossCount: 20,
                  totalWins: 400000, // $4000 in cents
                  totalLosses: 150000, // $1500 in cents
                  firstTradeDate: new Date("2024-01-01"),
                  lastTradeDate: new Date("2024-12-15"),
                },
              ]),
            }),
          }),
        }),
      };

      const { getDb } = await import("./db");
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      // Re-import to get fresh module with mocked db
      vi.resetModules();
      const { getTradeSourceBreakdown } = await import(
        "./tradeSourceAnalytics"
      );
      const result = await getTradeSourceBreakdown({});

      expect(result.totalTrades).toBe(150);
      expect(result.breakdown).toHaveLength(2);

      // Check CSV import breakdown
      const csvBreakdown = result.breakdown.find(
        b => b.source === "csv_import"
      );
      expect(csvBreakdown).toBeDefined();
      expect(csvBreakdown?.tradeCount).toBe(100);
      expect(csvBreakdown?.winRate).toBe(60);
      expect(csvBreakdown?.totalPnL).toBe(5000);

      // Check webhook breakdown
      const webhookBreakdown = result.breakdown.find(
        b => b.source === "webhook"
      );
      expect(webhookBreakdown).toBeDefined();
      expect(webhookBreakdown?.tradeCount).toBe(50);
      expect(webhookBreakdown?.winRate).toBe(60);
    });

    it("should calculate correct source distribution percentages", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue([
                {
                  source: "csv_import",
                  tradeCount: 80,
                  totalPnL: 0,
                  winCount: 40,
                  lossCount: 40,
                  totalWins: 0,
                  totalLosses: 0,
                  firstTradeDate: null,
                  lastTradeDate: null,
                },
                {
                  source: "webhook",
                  tradeCount: 20,
                  totalPnL: 0,
                  winCount: 10,
                  lossCount: 10,
                  totalWins: 0,
                  totalLosses: 0,
                  firstTradeDate: null,
                  lastTradeDate: null,
                },
              ]),
            }),
          }),
        }),
      };

      const { getDb } = await import("./db");
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      vi.resetModules();
      const { getTradeSourceBreakdown } = await import(
        "./tradeSourceAnalytics"
      );
      const result = await getTradeSourceBreakdown({});

      expect(result.sourceDistribution).toHaveLength(2);

      const csvDist = result.sourceDistribution.find(
        d => d.source === "csv_import"
      );
      expect(csvDist?.percentage).toBe(80);

      const webhookDist = result.sourceDistribution.find(
        d => d.source === "webhook"
      );
      expect(webhookDist?.percentage).toBe(20);
    });
  });

  describe("getWebhookSignalPerformance", () => {
    it("should return empty performance when no database connection", async () => {
      const { getDb } = await import("./db");
      vi.mocked(getDb).mockResolvedValue(null);

      vi.resetModules();
      const { getWebhookSignalPerformance } = await import(
        "./tradeSourceAnalytics"
      );
      const result = await getWebhookSignalPerformance({});

      expect(result.totalSignals).toBe(0);
      expect(result.successfulTrades).toBe(0);
      expect(result.totalPnL).toBe(0);
      expect(result.winRate).toBe(0);
      expect(result.signalsByStrategy).toEqual([]);
    });

    it("should calculate correct webhook performance metrics", async () => {
      const mockDb = {
        select: vi
          .fn()
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  totalSignals: 100,
                  totalPnL: 1000000, // $10,000 in cents
                  winCount: 65,
                  totalWins: 1500000, // $15,000 in cents
                  totalLosses: 500000, // $5,000 in cents
                },
              ]),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                groupBy: vi.fn().mockResolvedValue([
                  {
                    strategyId: 1,
                    tradeCount: 60,
                    totalPnL: 600000,
                    winCount: 40,
                  },
                  {
                    strategyId: 2,
                    tradeCount: 40,
                    totalPnL: 400000,
                    winCount: 25,
                  },
                ]),
              }),
            }),
          }),
      };

      const { getDb } = await import("./db");
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      vi.resetModules();
      const { getWebhookSignalPerformance } = await import(
        "./tradeSourceAnalytics"
      );
      const result = await getWebhookSignalPerformance({});

      expect(result.totalSignals).toBe(100);
      expect(result.totalPnL).toBe(10000);
      expect(result.winRate).toBe(65);
      expect(result.profitFactor).toBe(3); // 15000 / 5000
      expect(result.avgPnL).toBe(100); // 10000 / 100
      expect(result.signalsByStrategy).toHaveLength(2);
    });

    it("should handle zero losses (infinite profit factor)", async () => {
      const mockDb = {
        select: vi
          .fn()
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  totalSignals: 10,
                  totalPnL: 100000, // $1,000 in cents
                  winCount: 10,
                  totalWins: 100000,
                  totalLosses: 0, // No losses
                },
              ]),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                groupBy: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
      };

      const { getDb } = await import("./db");
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      vi.resetModules();
      const { getWebhookSignalPerformance } = await import(
        "./tradeSourceAnalytics"
      );
      const result = await getWebhookSignalPerformance({});

      expect(result.profitFactor).toBe(Infinity);
      expect(result.winRate).toBe(100);
    });
  });
});
