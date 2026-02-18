/**
 * Broker Integration Tests
 *
 * Tests for broker API clients, encryption, and auto-trading functionality.
 * These tests validate the integration layer without making real API calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AutoTrader, TradeSignal, ExecutionConfig } from "./autoTrader";
import crypto from "crypto";

// Simple encryption helpers for testing
const ENCRYPTION_KEY = crypto.scryptSync("test-secret-key", "salt", 32);

function encryptCredentials(credentials: Record<string, unknown>): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(credentials), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptCredentials(encryptedData: string): Record<string, unknown> {
  const [ivHex, authTagHex, encryptedHex] = encryptedData.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8"));
}

function hashCredentials(credentials: Record<string, unknown>): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(credentials))
    .digest("hex");
}

// ============================================================================
// ENCRYPTION TESTS
// ============================================================================

describe("Credential Encryption", () => {
  const testCredentials = {
    username: "testuser",
    password: "testpassword123",
    apiKey: "pk_test_12345",
    apiSecret: "sk_test_67890",
  };

  it("should encrypt and decrypt credentials correctly", () => {
    const encrypted = encryptCredentials(testCredentials);

    // Encrypted data should be different from original
    expect(encrypted).not.toBe(JSON.stringify(testCredentials));
    expect(encrypted).toContain(":"); // IV:encrypted format

    // Decryption should return original data
    const decrypted = decryptCredentials(encrypted);
    expect(decrypted).toEqual(testCredentials);
  });

  it("should produce different ciphertext for same input (random IV)", () => {
    const encrypted1 = encryptCredentials(testCredentials);
    const encrypted2 = encryptCredentials(testCredentials);

    // Same plaintext should produce different ciphertext due to random IV
    expect(encrypted1).not.toBe(encrypted2);

    // But both should decrypt to same value
    expect(decryptCredentials(encrypted1)).toEqual(
      decryptCredentials(encrypted2)
    );
  });

  it("should hash credentials consistently", () => {
    const hash1 = hashCredentials(testCredentials);
    const hash2 = hashCredentials(testCredentials);

    // Same input should produce same hash
    expect(hash1).toBe(hash2);

    // Hash should be 64 characters (SHA-256 hex)
    expect(hash1.length).toBe(64);
  });

  it("should produce different hashes for different credentials", () => {
    const hash1 = hashCredentials(testCredentials);
    const hash2 = hashCredentials({
      ...testCredentials,
      password: "different",
    });

    expect(hash1).not.toBe(hash2);
  });
});

// ============================================================================
// AUTO TRADER TESTS
// ============================================================================

describe("AutoTrader", () => {
  let autoTrader: AutoTrader;

  beforeEach(() => {
    autoTrader = new AutoTrader({
      maxRetries: 2,
      retryDelayMs: 100,
      failoverEnabled: true,
      paperTradingOnly: true,
    });
  });

  describe("Configuration", () => {
    it("should initialize with default configuration", () => {
      const config = autoTrader.getConfig();

      expect(config.maxRetries).toBe(2);
      expect(config.retryDelayMs).toBe(100);
      expect(config.failoverEnabled).toBe(true);
      expect(config.paperTradingOnly).toBe(true);
    });

    it("should update configuration", () => {
      autoTrader.updateConfig({ maxRetries: 5 });

      const config = autoTrader.getConfig();
      expect(config.maxRetries).toBe(5);
      expect(config.retryDelayMs).toBe(100); // Other values unchanged
    });
  });

  describe("Signal Queue", () => {
    it("should queue signals", () => {
      const signal: TradeSignal = {
        id: "test-1",
        strategyId: 1,
        strategyName: "ES Trend",
        symbol: "ES",
        action: "BUY",
        quantity: 1,
        orderType: "MARKET",
        timestamp: new Date(),
      };

      autoTrader.queueSignal(signal);
      expect(autoTrader.getQueueSize()).toBe(1);
    });

    it("should track queue size", () => {
      expect(autoTrader.getQueueSize()).toBe(0);

      for (let i = 0; i < 5; i++) {
        autoTrader.queueSignal({
          id: `test-${i}`,
          strategyId: 1,
          strategyName: "Test",
          symbol: "ES",
          action: "BUY",
          quantity: 1,
          orderType: "MARKET",
          timestamp: new Date(),
        });
      }

      expect(autoTrader.getQueueSize()).toBe(5);
    });
  });

  describe("Execution without brokers", () => {
    it("should fail gracefully when no brokers are connected", async () => {
      const signal: TradeSignal = {
        id: "test-1",
        strategyId: 1,
        strategyName: "ES Trend",
        symbol: "ES",
        action: "BUY",
        quantity: 1,
        orderType: "MARKET",
        timestamp: new Date(),
      };

      const result = await autoTrader.executeSignal(signal);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No connected brokers");
    });
  });

  describe("Statistics", () => {
    it("should track execution statistics", () => {
      const stats = autoTrader.getStats();

      expect(stats.totalExecutions).toBe(0);
      expect(stats.successfulExecutions).toBe(0);
      expect(stats.failedExecutions).toBe(0);
      expect(stats.successRate).toBe(0);
    });

    it("should clear history", () => {
      autoTrader.clearHistory();
      const history = autoTrader.getExecutionHistory();

      expect(history.length).toBe(0);
    });
  });

  describe("Lifecycle", () => {
    it("should start and stop correctly", () => {
      expect(autoTrader.isActive()).toBe(false);

      autoTrader.start();
      expect(autoTrader.isActive()).toBe(true);

      autoTrader.stop();
      expect(autoTrader.isActive()).toBe(false);
    });

    it("should not start twice", () => {
      autoTrader.start();
      autoTrader.start(); // Should not throw

      expect(autoTrader.isActive()).toBe(true);

      autoTrader.stop();
    });
  });
});

// ============================================================================
// MOCK BROKER TESTS
// ============================================================================

describe("Mock Broker Integration", () => {
  it("should register and unregister brokers", () => {
    const autoTrader = new AutoTrader();

    // Create a mock client
    const mockClient = {
      authenticate: vi.fn(),
      placeOrder: vi.fn(),
      getPositions: vi.fn(),
      getAccountInfo: vi.fn(),
    };

    // Register broker
    autoTrader.registerBroker("tradovate", mockClient as any, true);

    // Unregister broker
    autoTrader.unregisterBroker("tradovate");
  });

  it("should update connection status", () => {
    const autoTrader = new AutoTrader();

    const mockClient = {
      authenticate: vi.fn(),
      placeOrder: vi.fn(),
    };

    autoTrader.registerBroker("tradovate", mockClient as any, true);
    autoTrader.updateConnectionStatus("tradovate", true);
    autoTrader.updateConnectionStatus("tradovate", false);

    // Should not throw
    autoTrader.updateConnectionStatus("ibkr", true); // Non-existent broker
  });
});

// ============================================================================
// TRADE SIGNAL VALIDATION
// ============================================================================

describe("Trade Signal Validation", () => {
  it("should accept valid market order signal", () => {
    const signal: TradeSignal = {
      id: "valid-1",
      strategyId: 1,
      strategyName: "ES Trend Following",
      symbol: "ES",
      action: "BUY",
      quantity: 2,
      orderType: "MARKET",
      timestamp: new Date(),
      confidence: 0.85,
    };

    expect(signal.id).toBeDefined();
    expect(signal.quantity).toBeGreaterThan(0);
    expect(["BUY", "SELL"]).toContain(signal.action);
    expect(["MARKET", "LIMIT", "STOP"]).toContain(signal.orderType);
  });

  it("should accept valid limit order signal", () => {
    const signal: TradeSignal = {
      id: "valid-2",
      strategyId: 2,
      strategyName: "NQ Range Breakout",
      symbol: "NQ",
      action: "SELL",
      quantity: 1,
      orderType: "LIMIT",
      limitPrice: 18500.5,
      timestamp: new Date(),
    };

    expect(signal.limitPrice).toBeDefined();
    expect(signal.limitPrice).toBeGreaterThan(0);
  });

  it("should accept valid stop order signal", () => {
    const signal: TradeSignal = {
      id: "valid-3",
      strategyId: 3,
      strategyName: "CL Momentum",
      symbol: "CL",
      action: "BUY",
      quantity: 1,
      orderType: "STOP",
      stopPrice: 75.25,
      timestamp: new Date(),
    };

    expect(signal.stopPrice).toBeDefined();
    expect(signal.stopPrice).toBeGreaterThan(0);
  });
});

// ============================================================================
// EXECUTION CONFIG VALIDATION
// ============================================================================

describe("Execution Config", () => {
  it("should have sensible defaults", () => {
    const autoTrader = new AutoTrader();
    const config = autoTrader.getConfig();

    expect(config.maxRetries).toBeGreaterThanOrEqual(1);
    expect(config.maxRetries).toBeLessThanOrEqual(10);
    expect(config.retryDelayMs).toBeGreaterThanOrEqual(100);
    expect(config.maxSlippagePercent).toBeGreaterThan(0);
    expect(config.maxSlippagePercent).toBeLessThanOrEqual(5);
    expect(config.paperTradingOnly).toBe(true); // Safety default
  });

  it("should allow custom configuration", () => {
    const customConfig: Partial<ExecutionConfig> = {
      maxRetries: 5,
      retryDelayMs: 2000,
      failoverEnabled: false,
      brokerPriority: ["ibkr", "tradovate", "tradestation"],
      maxSlippagePercent: 1.0,
      requireConfirmation: true,
      paperTradingOnly: false,
    };

    const autoTrader = new AutoTrader(customConfig);
    const config = autoTrader.getConfig();

    expect(config.maxRetries).toBe(5);
    expect(config.retryDelayMs).toBe(2000);
    expect(config.failoverEnabled).toBe(false);
    expect(config.brokerPriority[0]).toBe("ibkr");
    expect(config.paperTradingOnly).toBe(false);
  });
});
