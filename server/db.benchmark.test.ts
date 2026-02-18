import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";

describe("Benchmark Data Date Conversion", () => {
  it("should return benchmark data with Date objects", async () => {
    // Get benchmark data for SPY
    const benchmarkData = await db.getBenchmarkData({
      symbol: "SPY",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-12-31"),
    });

    // Verify we got data
    expect(benchmarkData.length).toBeGreaterThan(0);

    // Verify all dates are Date objects, not strings
    for (const point of benchmarkData) {
      expect(point.date).toBeInstanceOf(Date);
      expect(typeof point.date.getTime).toBe("function");

      // Verify getTime() works without error
      const timestamp = point.date.getTime();
      expect(typeof timestamp).toBe("number");
      expect(timestamp).toBeGreaterThan(0);
    }
  });

  it("should handle date sorting correctly", async () => {
    const benchmarkData = await db.getBenchmarkData({
      symbol: "SPY",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-12-31"),
    });

    if (benchmarkData.length > 1) {
      // Verify dates are sorted
      for (let i = 1; i < benchmarkData.length; i++) {
        const prevTime = benchmarkData[i - 1]!.date.getTime();
        const currTime = benchmarkData[i]!.date.getTime();
        expect(currTime).toBeGreaterThanOrEqual(prevTime);
      }
    }
  });

  it("should work with different benchmark symbols", async () => {
    const symbols = ["SPY", "QQQ", "IWM", "GLD"];

    for (const symbol of symbols) {
      const benchmarkData = await db.getBenchmarkData({
        symbol,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
      });

      if (benchmarkData.length > 0) {
        // Verify all dates are Date objects
        for (const point of benchmarkData) {
          expect(point.date).toBeInstanceOf(Date);
          expect(typeof point.date.getTime).toBe("function");
        }
      }
    }
  });

  it("should handle date range filtering", async () => {
    const startDate = new Date("2024-06-01");
    const endDate = new Date("2024-06-30");

    const benchmarkData = await db.getBenchmarkData({
      symbol: "SPY",
      startDate,
      endDate,
    });

    // Verify all returned dates are within the range
    for (const point of benchmarkData) {
      const pointTime = point.date.getTime();
      expect(pointTime).toBeGreaterThanOrEqual(startDate.getTime());
      expect(pointTime).toBeLessThanOrEqual(endDate.getTime());
    }
  });
});
