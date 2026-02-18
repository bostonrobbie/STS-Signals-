import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getAllStrategies: vi.fn(),
  getTrades: vi.fn(),
  getStrategyById: vi.fn(),
  getBenchmarkData: vi.fn(),
}));

// Mock the cache module
vi.mock("./cache", () => ({
  cache: {
    getOrCompute: vi.fn(async (_key: string, fn: () => Promise<unknown>) =>
      fn()
    ),
  },
  cacheKeys: {
    platformStats: () => "platform_stats",
  },
  cacheTTL: {
    platformStats: 300000,
  },
}));

// Mock the notification module
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

import * as db from "./db";
import { appRouter } from "./routers";

// Create a mock context for public procedures (no user)
const createPublicContext = () => ({
  user: null,
  req: {
    headers: {
      host: "localhost:3000",
      "x-forwarded-proto": "https",
    },
    protocol: "https",
  } as any,
  res: {
    setHeader: vi.fn(),
    clearCookie: vi.fn(),
    cookie: vi.fn(),
  } as any,
});

// Sample test data
const mockStrategies = [
  {
    id: 1,
    name: "ES Trend Following",
    symbol: "ESTrend",
    market: "ES",
    description: "S&P 500 trend following strategy",
    microToMiniRatio: 10,
    createdAt: new Date("2020-01-01"),
    updatedAt: new Date("2020-01-01"),
  },
  {
    id: 2,
    name: "NQ Opening Range",
    symbol: "NQORB",
    market: "NQ",
    description: "NASDAQ opening range breakout",
    microToMiniRatio: 10,
    createdAt: new Date("2020-01-01"),
    updatedAt: new Date("2020-01-01"),
  },
];

const mockTrades = [
  {
    id: 1,
    strategyId: 1,
    entryDate: new Date("2024-01-15T10:00:00Z"),
    exitDate: new Date("2024-01-15T14:00:00Z"),
    direction: "long" as const,
    entryPrice: 4800,
    exitPrice: 4850,
    pnl: 2500,
    source: "csv_import" as const,
    createdAt: new Date("2024-01-15"),
  },
  {
    id: 2,
    strategyId: 1,
    entryDate: new Date("2024-01-16T10:00:00Z"),
    exitDate: new Date("2024-01-16T15:00:00Z"),
    direction: "short" as const,
    entryPrice: 4860,
    exitPrice: 4820,
    pnl: 2000,
    source: "csv_import" as const,
    createdAt: new Date("2024-01-16"),
  },
  {
    id: 3,
    strategyId: 2,
    entryDate: new Date("2024-01-17T09:30:00Z"),
    exitDate: new Date("2024-01-17T11:00:00Z"),
    direction: "long" as const,
    entryPrice: 16500,
    exitPrice: 16600,
    pnl: 2000,
    source: "csv_import" as const,
    createdAt: new Date("2024-01-17"),
  },
];

describe("Public API Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("publicApi.listStrategies", () => {
    it("should return list of strategies with metrics without authentication", async () => {
      vi.mocked(db.getAllStrategies).mockResolvedValue(mockStrategies);
      vi.mocked(db.getTrades).mockImplementation(async ({ strategyIds }) => {
        return mockTrades.filter(t => strategyIds?.includes(t.strategyId));
      });

      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.publicApi.listStrategies();

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(2);
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("symbol");
      expect(result[0]).toHaveProperty("market");
      expect(result[0]).toHaveProperty("totalReturn");
      expect(result[0]).toHaveProperty("sharpeRatio");
      expect(result[0]).toHaveProperty("winRate");
    });

    it("should return zero metrics for strategies with no trades", async () => {
      vi.mocked(db.getAllStrategies).mockResolvedValue([mockStrategies[0]!]);
      vi.mocked(db.getTrades).mockResolvedValue([]);

      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.publicApi.listStrategies();

      expect(result[0]!.totalReturn).toBe(0);
      expect(result[0]!.sharpeRatio).toBe(0);
      expect(result[0]!.totalTrades).toBe(0);
    });

    it("should include strategy description in response", async () => {
      vi.mocked(db.getAllStrategies).mockResolvedValue(mockStrategies);
      vi.mocked(db.getTrades).mockResolvedValue([]);

      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.publicApi.listStrategies();

      expect(result[0]).toHaveProperty("description");
      expect(result[0]!.description).toBe("S&P 500 trend following strategy");
    });
  });

  describe("publicApi.overview", () => {
    it("should return portfolio overview without authentication", async () => {
      vi.mocked(db.getAllStrategies).mockResolvedValue(mockStrategies);
      vi.mocked(db.getTrades).mockResolvedValue(mockTrades);

      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.publicApi.overview({});

      expect(result).toHaveProperty("metrics");
      expect(result).toHaveProperty("equityCurve");
      expect(result).toHaveProperty("strategyCount");
      expect(result.strategyCount).toBe(2);
    });

    it("should return metrics with expected properties", async () => {
      vi.mocked(db.getAllStrategies).mockResolvedValue(mockStrategies);
      vi.mocked(db.getTrades).mockResolvedValue(mockTrades);

      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.publicApi.overview({});

      expect(result.metrics).toHaveProperty("totalReturn");
      expect(result.metrics).toHaveProperty("sharpeRatio");
      expect(result.metrics).toHaveProperty("maxDrawdown");
      expect(result.metrics).toHaveProperty("winRate");
      expect(result.metrics).toHaveProperty("profitFactor");
      expect(result.metrics).toHaveProperty("totalTrades");
    });

    it("should return sampled equity curve for mobile efficiency", async () => {
      vi.mocked(db.getAllStrategies).mockResolvedValue(mockStrategies);
      vi.mocked(db.getTrades).mockResolvedValue(mockTrades);

      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.publicApi.overview({});

      expect(result.equityCurve).toBeInstanceOf(Array);
      // Equity curve should be sampled to max 100 points
      expect(result.equityCurve.length).toBeLessThanOrEqual(101);
    });

    it("should filter by time range when provided", async () => {
      vi.mocked(db.getAllStrategies).mockResolvedValue(mockStrategies);
      vi.mocked(db.getTrades).mockResolvedValue(mockTrades);

      const caller = appRouter.createCaller(createPublicContext());
      await caller.publicApi.overview({ timeRange: "1Y" });

      // Verify getTrades was called with a startDate
      expect(db.getTrades).toHaveBeenCalled();
      const callArgs = vi.mocked(db.getTrades).mock.calls[0]![0];
      expect(callArgs.startDate).toBeDefined();
    });

    it("should include daily metrics", async () => {
      vi.mocked(db.getAllStrategies).mockResolvedValue(mockStrategies);
      vi.mocked(db.getTrades).mockResolvedValue(mockTrades);

      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.publicApi.overview({});

      expect(result).toHaveProperty("dailyMetrics");
      expect(result.dailyMetrics).toHaveProperty("sharpe");
      expect(result.dailyMetrics).toHaveProperty("sortino");
      expect(result.dailyMetrics).toHaveProperty("tradingDays");
    });
  });

  describe("publicApi.strategyDetail", () => {
    it("should return strategy detail without authentication", async () => {
      vi.mocked(db.getStrategyById).mockResolvedValue(mockStrategies[0]!);
      vi.mocked(db.getTrades).mockResolvedValue(
        mockTrades.filter(t => t.strategyId === 1)
      );

      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.publicApi.strategyDetail({ strategyId: 1 });

      expect(result).toHaveProperty("strategy");
      expect(result).toHaveProperty("metrics");
      expect(result).toHaveProperty("equityCurve");
      expect(result).toHaveProperty("recentTrades");
    });

    it("should throw error for non-existent strategy", async () => {
      vi.mocked(db.getStrategyById).mockResolvedValue(null);

      const caller = appRouter.createCaller(createPublicContext());

      await expect(
        caller.publicApi.strategyDetail({ strategyId: 999 })
      ).rejects.toThrow("Strategy not found");
    });

    it("should return limited recent trades for mobile", async () => {
      vi.mocked(db.getStrategyById).mockResolvedValue(mockStrategies[0]!);
      vi.mocked(db.getTrades).mockResolvedValue(
        mockTrades.filter(t => t.strategyId === 1)
      );

      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.publicApi.strategyDetail({ strategyId: 1 });

      // Should return max 20 recent trades
      expect(result.recentTrades.length).toBeLessThanOrEqual(20);
    });

    it("should include strategy info in response", async () => {
      vi.mocked(db.getStrategyById).mockResolvedValue(mockStrategies[0]!);
      vi.mocked(db.getTrades).mockResolvedValue([]);

      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.publicApi.strategyDetail({ strategyId: 1 });

      expect(result.strategy).toHaveProperty("id");
      expect(result.strategy).toHaveProperty("name");
      expect(result.strategy).toHaveProperty("symbol");
      expect(result.strategy).toHaveProperty("market");
      expect(result.strategy).toHaveProperty("description");
    });

    it("should filter by time range when provided", async () => {
      vi.mocked(db.getStrategyById).mockResolvedValue(mockStrategies[0]!);
      vi.mocked(db.getTrades).mockResolvedValue([]);

      const caller = appRouter.createCaller(createPublicContext());
      await caller.publicApi.strategyDetail({
        strategyId: 1,
        timeRange: "YTD",
      });

      expect(db.getTrades).toHaveBeenCalled();
      const callArgs = vi.mocked(db.getTrades).mock.calls[0]![0];
      expect(callArgs.startDate).toBeDefined();
    });

    it("should include metrics with all expected fields", async () => {
      vi.mocked(db.getStrategyById).mockResolvedValue(mockStrategies[0]!);
      vi.mocked(db.getTrades).mockResolvedValue(
        mockTrades.filter(t => t.strategyId === 1)
      );

      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.publicApi.strategyDetail({ strategyId: 1 });

      expect(result.metrics).toHaveProperty("totalReturn");
      expect(result.metrics).toHaveProperty("annualizedReturn");
      expect(result.metrics).toHaveProperty("sharpeRatio");
      expect(result.metrics).toHaveProperty("sortinoRatio");
      expect(result.metrics).toHaveProperty("maxDrawdown");
      expect(result.metrics).toHaveProperty("winRate");
      expect(result.metrics).toHaveProperty("profitFactor");
      expect(result.metrics).toHaveProperty("avgWin");
      expect(result.metrics).toHaveProperty("avgLoss");
    });
  });

  describe("Public API - No Auth Required", () => {
    it("should not require authentication for listStrategies", async () => {
      vi.mocked(db.getAllStrategies).mockResolvedValue([]);
      vi.mocked(db.getTrades).mockResolvedValue([]);

      // Context with no user
      const caller = appRouter.createCaller(createPublicContext());

      // Should not throw authentication error
      const result = await caller.publicApi.listStrategies();
      expect(result).toBeInstanceOf(Array);
    });

    it("should not require authentication for overview", async () => {
      vi.mocked(db.getAllStrategies).mockResolvedValue([]);
      vi.mocked(db.getTrades).mockResolvedValue([]);

      const caller = appRouter.createCaller(createPublicContext());

      // Should not throw authentication error
      const result = await caller.publicApi.overview({});
      expect(result).toHaveProperty("metrics");
    });

    it("should not require authentication for strategyDetail", async () => {
      vi.mocked(db.getStrategyById).mockResolvedValue(mockStrategies[0]!);
      vi.mocked(db.getTrades).mockResolvedValue([]);

      const caller = appRouter.createCaller(createPublicContext());

      // Should not throw authentication error
      const result = await caller.publicApi.strategyDetail({ strategyId: 1 });
      expect(result).toHaveProperty("strategy");
    });
  });
});
