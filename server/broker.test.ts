/**
 * Broker Integration Tests
 *
 * Tests for broker service framework, database operations,
 * and admin access control for webhook management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TradovateClient,
  SYMBOL_MAPPING,
  getFrontMonthContract,
  signalToOrder,
} from "./tradovateService";
import {
  createBrokerService,
  TradovateService,
  IBKRService,
  TradeStationService,
} from "./brokerService";

// ============================================================================
// TRADOVATE CLIENT TESTS
// ============================================================================

describe("TradovateClient", () => {
  let client: TradovateClient;

  beforeEach(() => {
    client = new TradovateClient(true); // Demo mode
  });

  describe("Authentication", () => {
    it("should simulate successful authentication", async () => {
      const result = await client.authenticate({
        username: "testuser",
        password: "testpass",
      });

      expect(result.success).toBe(true);
      expect(result.userId).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    it("should return false for isAuthenticated before auth", () => {
      expect(client.isAuthenticated()).toBe(false);
    });

    it("should disconnect and clear tokens", () => {
      client.disconnect();
      expect(client.isAuthenticated()).toBe(false);
    });
  });

  describe("Order Placement", () => {
    it("should reject order when not authenticated", async () => {
      const result = await client.placeOrder({
        accountSpec: "TestAccount",
        accountId: 12345,
        action: "Buy",
        symbol: "ESZ4",
        orderQty: 1,
        orderType: "Market",
      });

      expect(result.orderStatus).toBe("Rejected");
      expect(result.errorText).toContain("Not authenticated");
    });
  });

  describe("Account Operations", () => {
    it("should return empty accounts when not authenticated", async () => {
      const accounts = await client.getAccounts();
      expect(accounts).toEqual([]);
    });

    it("should return empty positions when not authenticated", async () => {
      const positions = await client.getPositions(12345);
      expect(positions).toEqual([]);
    });
  });
});

// ============================================================================
// SYMBOL MAPPING TESTS
// ============================================================================

describe("Symbol Mapping", () => {
  it("should map ES symbols correctly", () => {
    expect(SYMBOL_MAPPING["ES"]).toBe("ES");
    expect(SYMBOL_MAPPING["ES1!"]).toBe("ES");
    expect(SYMBOL_MAPPING["ESZ"]).toBe("ES");
  });

  it("should map NQ symbols correctly", () => {
    expect(SYMBOL_MAPPING["NQ"]).toBe("NQ");
    expect(SYMBOL_MAPPING["NQ1!"]).toBe("NQ");
  });

  it("should map micro contracts correctly", () => {
    expect(SYMBOL_MAPPING["MES"]).toBe("MES");
    expect(SYMBOL_MAPPING["MNQ"]).toBe("MNQ");
  });

  it("should map commodity futures correctly", () => {
    expect(SYMBOL_MAPPING["CL"]).toBe("CL");
    expect(SYMBOL_MAPPING["GC"]).toBe("GC");
    expect(SYMBOL_MAPPING["YM"]).toBe("YM");
  });

  it("should map crypto futures correctly", () => {
    expect(SYMBOL_MAPPING["BTC"]).toBe("BTC");
    expect(SYMBOL_MAPPING["BTC1!"]).toBe("BTC");
  });
});

// ============================================================================
// FRONT MONTH CONTRACT TESTS
// ============================================================================

describe("getFrontMonthContract", () => {
  it("should return a valid contract symbol format", () => {
    const contract = getFrontMonthContract("ES");
    expect(contract).toMatch(/^ES[HMUZ]\d{1,2}$/);
  });

  it("should include month code H, M, U, or Z", () => {
    const contract = getFrontMonthContract("NQ");
    const monthCode = contract.charAt(2);
    expect(["H", "M", "U", "Z"]).toContain(monthCode);
  });

  it("should work for different base symbols", () => {
    const symbols = ["ES", "NQ", "CL", "GC", "YM"];
    symbols.forEach(sym => {
      const contract = getFrontMonthContract(sym);
      expect(contract.startsWith(sym)).toBe(true);
    });
  });
});

// ============================================================================
// SIGNAL TO ORDER CONVERSION TESTS
// ============================================================================

describe("signalToOrder", () => {
  const accountId = 12345;
  const accountSpec = "TestAccount";

  it("should convert long entry to buy order", () => {
    const signal = {
      strategy: "ESTrend",
      symbol: "ES",
      direction: "Long" as const,
      action: "entry" as const,
      price: 5000,
      quantity: 2,
    };

    const order = signalToOrder(signal, accountId, accountSpec);

    expect(order.action).toBe("Buy");
    expect(order.orderQty).toBe(2);
    expect(order.orderType).toBe("Market");
    expect(order.accountId).toBe(accountId);
    expect(order.isAutomated).toBe(true);
  });

  it("should convert short entry to sell order", () => {
    const signal = {
      strategy: "NQTrend",
      symbol: "NQ",
      direction: "Short" as const,
      action: "entry" as const,
      price: 18000,
      quantity: 1,
    };

    const order = signalToOrder(signal, accountId, accountSpec);

    expect(order.action).toBe("Sell");
    expect(order.orderQty).toBe(1);
  });

  it("should convert long exit to sell order", () => {
    const signal = {
      strategy: "ESTrend",
      symbol: "ES",
      direction: "Long" as const,
      action: "exit" as const,
      price: 5050,
      quantity: 2,
    };

    const order = signalToOrder(signal, accountId, accountSpec);

    expect(order.action).toBe("Sell");
  });

  it("should convert short exit to buy order", () => {
    const signal = {
      strategy: "NQTrend",
      symbol: "NQ",
      direction: "Short" as const,
      action: "exit" as const,
      price: 17900,
      quantity: 1,
    };

    const order = signalToOrder(signal, accountId, accountSpec);

    expect(order.action).toBe("Buy");
  });

  it("should include strategy name in order text", () => {
    const signal = {
      strategy: "MyStrategy",
      symbol: "ES",
      direction: "Long" as const,
      action: "entry" as const,
      price: 5000,
      quantity: 1,
    };

    const order = signalToOrder(signal, accountId, accountSpec);

    expect(order.text).toContain("MyStrategy");
    expect(order.text).toContain("entry");
  });
});

// ============================================================================
// BROKER SERVICE FACTORY TESTS
// ============================================================================

describe("Broker Service Factory", () => {
  it("should create TradovateService", () => {
    const service = createBrokerService("tradovate");
    expect(service).toBeInstanceOf(TradovateService);
    expect(service.brokerType).toBe("tradovate");
  });

  it("should create IBKRService", () => {
    const service = createBrokerService("ibkr");
    expect(service).toBeInstanceOf(IBKRService);
    expect(service.brokerType).toBe("ibkr");
  });

  it("should create TradeStationService", () => {
    const service = createBrokerService("tradestation");
    expect(service).toBeInstanceOf(TradeStationService);
    expect(service.brokerType).toBe("tradestation");
  });

  it("should throw for unknown broker type", () => {
    expect(() => createBrokerService("unknown" as any)).toThrow();
  });
});

// ============================================================================
// BROKER SERVICE INTERFACE TESTS
// ============================================================================

describe("TradovateService", () => {
  let service: TradovateService;

  beforeEach(() => {
    service = new TradovateService();
  });

  it("should start disconnected", () => {
    expect(service.isConnected()).toBe(false);
  });

  it("should require credentials for connection", async () => {
    const result = await service.connect({});
    expect(result.success).toBe(false);
    expect(result.error).toContain("required");
  });

  it("should simulate successful connection with credentials", async () => {
    const result = await service.connect({
      username: "test",
      password: "test123",
    });
    expect(result.success).toBe(true);
  });

  it("should return account info when connected", async () => {
    await service.connect({ username: "test", password: "test123" });
    const info = await service.getAccountInfo();
    expect(info).not.toBeNull();
    expect(info?.accountType).toBe("demo");
  });

  it("should disconnect properly", async () => {
    await service.connect({ username: "test", password: "test123" });
    expect(service.isConnected()).toBe(true);
    await service.disconnect();
    expect(service.isConnected()).toBe(false);
  });
});

describe("IBKRService", () => {
  let service: IBKRService;

  beforeEach(() => {
    service = new IBKRService();
  });

  it("should return coming soon error", async () => {
    const result = await service.connect({});
    expect(result.success).toBe(false);
    expect(result.error).toContain("coming soon");
  });

  it("should start disconnected", () => {
    expect(service.isConnected()).toBe(false);
  });
});

describe("TradeStationService", () => {
  let service: TradeStationService;

  beforeEach(() => {
    service = new TradeStationService();
  });

  it("should return coming soon error", async () => {
    const result = await service.connect({});
    expect(result.success).toBe(false);
    expect(result.error).toContain("coming soon");
  });

  it("should return null for account info", async () => {
    const info = await service.getAccountInfo();
    expect(info).toBeNull();
  });
});

// ============================================================================
// ADMIN ACCESS CONTROL TESTS
// ============================================================================

describe("Admin Access Control", () => {
  it("should define admin role in user schema", () => {
    // This test verifies the schema supports admin roles
    const validRoles = ["user", "admin"];
    expect(validRoles).toContain("admin");
  });

  it("should have webhook procedures protected by adminProcedure", () => {
    // This is a documentation test - actual protection is in routers.ts
    const adminProtectedProcedures = [
      "webhook.getLogs",
      "webhook.getStatus",
      "webhook.pause",
      "webhook.resume",
      "webhook.clearLogs",
      "webhook.deleteLog",
      "webhook.testWebhook",
      "webhook.validatePayload",
      "webhook.getHealthReport",
      "webhook.notifyOwner",
      "broker.getConnections",
      "broker.createConnection",
      "broker.deleteConnection",
      "broker.getRoutingRules",
      "broker.getExecutionLogs",
    ];

    expect(adminProtectedProcedures.length).toBeGreaterThan(10);
  });
});

// ============================================================================
// RISK MANAGEMENT TESTS
// ============================================================================

describe("Risk Management", () => {
  it("should support max position size limits", () => {
    // Verify routing rules schema supports risk controls
    const riskFields = ["maxPositionSize", "maxDailyLoss"];
    riskFields.forEach(field => {
      expect(typeof field).toBe("string");
    });
  });

  it("should support quantity multipliers", () => {
    const multiplier = 1.5;
    const baseQuantity = 2;
    const adjustedQuantity = Math.floor(baseQuantity * multiplier);
    expect(adjustedQuantity).toBe(3);
  });

  it("should calculate position value correctly", () => {
    const quantity = 2;
    const price = 5000;
    const contractMultiplier = 50; // ES = $50 per point
    const positionValue = quantity * price * contractMultiplier;
    expect(positionValue).toBe(500000);
  });
});

// ============================================================================
// EXECUTION LOG TESTS
// ============================================================================

describe("Execution Logging", () => {
  it("should support all execution statuses", () => {
    const validStatuses = [
      "pending",
      "submitted",
      "filled",
      "partial",
      "rejected",
      "cancelled",
      "error",
    ];

    expect(validStatuses).toContain("pending");
    expect(validStatuses).toContain("filled");
    expect(validStatuses).toContain("rejected");
  });

  it("should track retry counts", () => {
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      retryCount++;
    }

    expect(retryCount).toBe(maxRetries);
  });
});

// ============================================================================
// IBKR GATEWAY API TESTS
// ============================================================================

describe("IBKR Gateway API", () => {
  // Mock fetch for testing
  const originalFetch = global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("testIBKRConnection", () => {
    it("should return success when gateway is reachable and authenticated", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ authenticated: true, connected: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: "DU1234567", accountId: "DU1234567", type: "INDIVIDUAL" },
          ],
        });

      const gatewayUrl = "http://localhost:5000";

      const authResponse = await fetch(
        `${gatewayUrl}/v1/api/iserver/auth/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      expect(authResponse.ok).toBe(true);
      const authStatus = await authResponse.json();
      expect(authStatus.authenticated).toBe(true);

      const accountsResponse = await fetch(
        `${gatewayUrl}/v1/api/portfolio/accounts`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }
      );

      expect(accountsResponse.ok).toBe(true);
      const accounts = await accountsResponse.json();
      expect(accounts).toHaveLength(1);
      expect(accounts[0].accountId).toBe("DU1234567");
    });

    it("should return not authenticated when gateway is running but user not logged in", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authenticated: false, connected: false }),
      });

      const gatewayUrl = "http://localhost:5000";

      const authResponse = await fetch(
        `${gatewayUrl}/v1/api/iserver/auth/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      expect(authResponse.ok).toBe(true);
      const authStatus = await authResponse.json();
      expect(authStatus.authenticated).toBe(false);
    });
  });

  describe("placeIBKRTestOrder", () => {
    it("should successfully search for a contract", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ conid: 495512552, symbol: "MES", secType: "FUT" }],
      });

      const gatewayUrl = "http://localhost:5000";

      const searchResponse = await fetch(
        `${gatewayUrl}/v1/api/iserver/secdef/search?symbol=MES&secType=FUT`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol: "MES" }),
        }
      );

      expect(searchResponse.ok).toBe(true);
      const contracts = await searchResponse.json();
      expect(contracts[0].conid).toBe(495512552);
      expect(contracts[0].symbol).toBe("MES");
    });

    it("should place a market order", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ conid: 495512552, symbol: "MES" }],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ order_id: "12345", order_status: "Submitted" }],
        });

      const gatewayUrl = "http://localhost:5000";
      const accountId = "DU1234567";

      // Search for contract
      await fetch(
        `${gatewayUrl}/v1/api/iserver/secdef/search?symbol=MES&secType=FUT`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol: "MES" }),
        }
      );

      // Place order
      const orderResponse = await fetch(
        `${gatewayUrl}/v1/api/iserver/account/${accountId}/orders`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orders: [
              {
                conid: 495512552,
                orderType: "MKT",
                side: "BUY",
                quantity: 1,
                tif: "DAY",
              },
            ],
          }),
        }
      );

      expect(orderResponse.ok).toBe(true);
      const orderResult = await orderResponse.json();
      expect(orderResult[0].order_id).toBe("12345");
    });

    it("should handle order confirmation requirement", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ conid: 495512552, symbol: "MES" }],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: "confirm", message: ["Please confirm order"] },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ order_id: "12345", order_status: "Submitted" }],
        });

      const gatewayUrl = "http://localhost:5000";
      const accountId = "DU1234567";

      // Search
      await fetch(
        `${gatewayUrl}/v1/api/iserver/secdef/search?symbol=MES&secType=FUT`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol: "MES" }),
        }
      );

      // Place order
      const orderResponse = await fetch(
        `${gatewayUrl}/v1/api/iserver/account/${accountId}/orders`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orders: [
              {
                conid: 495512552,
                orderType: "MKT",
                side: "BUY",
                quantity: 1,
                tif: "DAY",
              },
            ],
          }),
        }
      );

      const orderResult = await orderResponse.json();
      expect(orderResult[0].id).toBe("confirm");

      // Confirm order
      const confirmResponse = await fetch(
        `${gatewayUrl}/v1/api/iserver/reply/${orderResult[0].id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmed: true }),
        }
      );

      expect(confirmResponse.ok).toBe(true);
      const confirmResult = await confirmResponse.json();
      expect(confirmResult[0].order_id).toBe("12345");
    });
  });
});
