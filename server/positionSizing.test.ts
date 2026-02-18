/**
 * Position Sizing Service Tests
 *
 * Tests the position sizing calculations for account-based position scaling.
 */

import { describe, it, expect } from "vitest";
import {
  calculatePositionSize,
  calculateUserPositionSize,
  BACKTEST_STARTING_CAPITAL,
  CONTRACT_SPECS,
} from "./positionSizingService";

describe("Position Sizing Service", () => {
  describe("calculatePositionSize", () => {
    it("should return 1x scaling for $100K account (same as backtest)", () => {
      const result = calculatePositionSize({
        accountValue: 100000,
        useLeveraged: true,
        contractType: "micro",
        baseQuantity: 1,
      });

      expect(result.scalingFactor).toBe(1);
      expect(result.miniContracts).toBe(1);
      expect(result.microContracts).toBe(10);
      expect(result.recommendedMicroContracts).toBe(10);
    });

    it("should return 0.5x scaling for $50K account", () => {
      const result = calculatePositionSize({
        accountValue: 50000,
        useLeveraged: true,
        contractType: "micro",
        baseQuantity: 1,
      });

      expect(result.scalingFactor).toBe(0.5);
      expect(result.miniContracts).toBe(0.5);
      expect(result.microContracts).toBe(5);
      expect(result.recommendedMicroContracts).toBe(5);
    });

    it("should return 2x scaling for $200K account", () => {
      const result = calculatePositionSize({
        accountValue: 200000,
        useLeveraged: true,
        contractType: "micro",
        baseQuantity: 1,
      });

      expect(result.scalingFactor).toBe(2);
      expect(result.miniContracts).toBe(2);
      expect(result.microContracts).toBe(20);
      expect(result.recommendedMicroContracts).toBe(20);
    });

    it("should return 0.1x scaling for $10K account", () => {
      const result = calculatePositionSize({
        accountValue: 10000,
        useLeveraged: true,
        contractType: "micro",
        baseQuantity: 1,
      });

      expect(result.scalingFactor).toBe(0.1);
      expect(result.miniContracts).toBe(0.1);
      expect(result.microContracts).toBe(1);
      expect(result.recommendedMicroContracts).toBe(1);
    });

    it("should use fixed position sizing when not leveraged", () => {
      const result = calculatePositionSize({
        accountValue: 50000,
        useLeveraged: false,
        contractType: "micro",
        baseQuantity: 1,
      });

      // Fixed sizing should not scale based on account value
      expect(result.microContracts).toBe(1);
      expect(result.recommendedMicroContracts).toBe(1);
    });

    it("should calculate margin utilization correctly", () => {
      const result = calculatePositionSize({
        accountValue: 100000,
        useLeveraged: true,
        contractType: "micro",
        baseQuantity: 1,
      });

      // 10 micro contracts * $500 margin = $5,000
      // $5,000 / $100,000 = 5%
      expect(result.marginRequired).toBe(5000);
      expect(result.marginUtilization).toBe(5);
    });
  });

  describe("calculateUserPositionSize", () => {
    it("should use default account value when null", () => {
      const result = calculateUserPositionSize({
        accountValue: null,
        useLeveraged: true,
        quantityMultiplier: "1",
        maxPositionSize: null,
      });

      expect(result.scalingFactor).toBe(1);
      expect(result.recommendedMicroContracts).toBe(10);
    });

    it("should apply quantity multiplier", () => {
      const result = calculateUserPositionSize({
        accountValue: 100000,
        useLeveraged: true,
        quantityMultiplier: "2",
        maxPositionSize: null,
      });

      // 2x multiplier should double the position
      expect(result.recommendedMicroContracts).toBe(20);
    });

    it("should respect max position size limit", () => {
      const result = calculateUserPositionSize(
        {
          accountValue: 200000,
          useLeveraged: true,
          quantityMultiplier: "1",
          maxPositionSize: 5, // Limit to 5 micro contracts
        },
        "micro"
      );

      // Should be capped at 5 even though scaling would give 20
      expect(result.recommendedMicroContracts).toBe(5);
    });
  });

  describe("Constants", () => {
    it("should have correct backtest starting capital", () => {
      expect(BACKTEST_STARTING_CAPITAL).toBe(100000);
    });

    it("should have correct NQ contract specs", () => {
      expect(CONTRACT_SPECS.NQ.micro.multiplier).toBe(2);
      expect(CONTRACT_SPECS.NQ.mini.multiplier).toBe(20);
      expect(CONTRACT_SPECS.NQ.microToMiniRatio).toBe(10);
    });

    it("should have correct ES contract specs", () => {
      expect(CONTRACT_SPECS.ES.micro.multiplier).toBe(5);
      expect(CONTRACT_SPECS.ES.mini.multiplier).toBe(50);
      expect(CONTRACT_SPECS.ES.microToMiniRatio).toBe(10);
    });
  });
});
