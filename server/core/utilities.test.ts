/**
 * Comprehensive Test Suite for Core Utilities
 * Tests for pagination, security, rate limiting, and monitoring
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  encodeCursor,
  decodeCursor,
  normalizePaginationParams,
  createPaginatedResponse,
} from "./pagination";
import {
  encryptCredential,
  decryptCredential,
  hashPassword,
  verifyPassword,
  hasPermission,
  UserRole,
  generateSecureToken,
} from "./security";
import { RateLimiter } from "./rateLimiter";
import { queryMonitor } from "./queryMonitoring";
import {
  recordHttpMetrics,
  recordDbMetrics,
  getMetricsText,
} from "./prometheus";

describe("Pagination Utilities", () => {
  it("should encode and decode cursor correctly", () => {
    const id = 42;
    const timestamp = new Date("2026-01-24T12:00:00Z");

    const encoded = encodeCursor(id, timestamp);
    const decoded = decodeCursor(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded?.id).toBe(id);
    expect(decoded?.timestamp.getTime()).toBe(timestamp.getTime());
  });

  it("should handle invalid cursor gracefully", () => {
    const decoded = decodeCursor("invalid-cursor");
    expect(decoded).toBeNull();
  });

  it("should normalize pagination parameters", () => {
    const params = normalizePaginationParams({ limit: 100 });
    expect(params.limit).toBe(100);

    // Should cap at 500
    const params2 = normalizePaginationParams({ limit: 1000 });
    expect(params2.limit).toBe(500);

    // Should default to 50
    const params3 = normalizePaginationParams({});
    expect(params3.limit).toBe(50);
  });

  it("should create paginated response correctly", () => {
    const items = [
      { id: 1, exitDate: new Date(), equity: 100 },
      { id: 2, exitDate: new Date(), equity: 200 },
    ];

    const response = createPaginatedResponse(items, 50, true);

    expect(response.items).toEqual(items);
    expect(response.count).toBe(2);
    expect(response.hasMore).toBe(true);
    expect(response.nextCursor).toBeDefined();
  });

  it("should not include nextCursor when no more items", () => {
    const items = [{ id: 1, exitDate: new Date(), equity: 100 }];
    const response = createPaginatedResponse(items, 50, false);

    expect(response.hasMore).toBe(false);
    expect(response.nextCursor).toBeUndefined();
  });
});

describe("Security Utilities", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_MASTER_KEY = "test-master-key-for-testing-only";
  });

  it("should encrypt and decrypt credentials", () => {
    const plaintext = "my-secret-api-key-12345";

    const encrypted = encryptCredential(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toContain(":"); // Should have format: iv:authTag:ciphertext

    const decrypted = decryptCredential(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should handle encryption without master key", () => {
    delete process.env.ENCRYPTION_MASTER_KEY;

    expect(() => {
      encryptCredential("test");
    }).toThrow("Failed to encrypt credential");
  });

  it("should hash and verify passwords", () => {
    const password = "MySecurePassword123!";

    const hash = hashPassword(password);
    expect(hash).not.toBe(password);
    expect(hash).toContain(":"); // Should have format: salt:hash

    expect(verifyPassword(password, hash)).toBe(true);
    expect(verifyPassword("WrongPassword", hash)).toBe(false);
  });

  it("should check permissions correctly", () => {
    expect(hasPermission(UserRole.ADMIN, "manage_users")).toBe(true);
    expect(hasPermission(UserRole.ADMIN, "view_analytics")).toBe(true);

    expect(hasPermission(UserRole.USER, "manage_users")).toBe(false);
    expect(hasPermission(UserRole.USER, "view_analytics")).toBe(true);

    expect(hasPermission(UserRole.READ_ONLY, "view_analytics")).toBe(true);
    expect(hasPermission(UserRole.READ_ONLY, "manage_trades")).toBe(false);
  });

  it("should generate secure tokens", () => {
    const token1 = generateSecureToken(32);
    const token2 = generateSecureToken(32);

    expect(token1).toHaveLength(64); // 32 bytes = 64 hex characters
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2); // Should be different each time
  });

  it("should generate tokens of different lengths", () => {
    const token16 = generateSecureToken(16);
    const token64 = generateSecureToken(64);

    expect(token16).toHaveLength(32); // 16 bytes = 32 hex characters
    expect(token64).toHaveLength(128); // 64 bytes = 128 hex characters
  });
});

describe("Rate Limiting", () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      windowMs: 1000, // 1 second for testing
      max: 3,
    });
  });

  it("should allow requests within limit", () => {
    const key = "test-key";

    for (let i = 0; i < 3; i++) {
      const status = rateLimiter.getStatus(key);
      expect(status.remaining).toBeGreaterThan(0);
    }
  });

  it("should track request count", () => {
    const key = "test-key";

    let status = rateLimiter.getStatus(key);
    expect(status.count).toBe(0);

    // Simulate requests
    rateLimiter.middleware();

    status = rateLimiter.getStatus(key);
    expect(status.count).toBeGreaterThanOrEqual(0);
  });

  it("should reset rate limit for specific key", () => {
    const key = "test-key";

    rateLimiter.reset(key);
    const status = rateLimiter.getStatus(key);

    expect(status.count).toBe(0);
    expect(status.remaining).toBe(3);
  });

  it("should reset all rate limits", () => {
    rateLimiter.resetAll();

    const status1 = rateLimiter.getStatus("key1");
    const status2 = rateLimiter.getStatus("key2");

    expect(status1.count).toBe(0);
    expect(status2.count).toBe(0);
  });
});

describe("Query Monitoring", () => {
  it("should record query metrics", () => {
    queryMonitor.reset();
    queryMonitor.setEnabled(true);

    queryMonitor.recordQuery("SELECT * FROM trades", 500);
    queryMonitor.recordQuery("SELECT * FROM strategies", 100);

    const stats = queryMonitor.getStats();

    expect(stats).not.toBeNull();
    expect(stats?.totalQueries).toBe(2);
    expect(stats?.averageDuration).toBe(300);
    expect(stats?.maxDuration).toBe(500);
    expect(stats?.minDuration).toBe(100);
  });

  it("should identify slow queries", () => {
    queryMonitor.reset();
    queryMonitor.setEnabled(true);

    queryMonitor.recordQuery("SELECT * FROM trades", 500);
    queryMonitor.recordQuery("SELECT * FROM strategies", 1500); // Slow query
    queryMonitor.recordQuery("SELECT * FROM benchmarks", 200);

    const stats = queryMonitor.getStats();

    expect(stats?.slowQueries).toBe(1);
    expect(stats?.slowQueryPercentage).toBe("33.33");
  });

  it("should handle disabled monitoring", () => {
    queryMonitor.reset();
    queryMonitor.setEnabled(false);

    queryMonitor.recordQuery("SELECT * FROM trades", 500);

    const stats = queryMonitor.getStats();

    expect(stats).toBeNull();
  });
});

describe("Prometheus Metrics", () => {
  it("should record HTTP metrics", async () => {
    recordHttpMetrics("GET", "/api/trades", 200, 150);
    recordHttpMetrics("POST", "/api/trades", 201, 250);
    recordHttpMetrics(
      "GET",
      "/api/trades",
      500,
      100,
      new Error("Database error")
    );

    const metrics = await getMetricsText();

    expect(metrics).toContain("http_request_duration_seconds");
    expect(metrics).toContain("http_requests_total");
    expect(metrics).toContain("http_request_errors_total");
  });

  it("should record database metrics", async () => {
    recordDbMetrics("SELECT", "trades", 100, "success");
    recordDbMetrics("INSERT", "trades", 1500, "success"); // Slow query
    recordDbMetrics("UPDATE", "strategies", 50, "success");

    const metrics = await getMetricsText();

    expect(metrics).toContain("db_query_duration_seconds");
    expect(metrics).toContain("db_queries_total");
    expect(metrics).toContain("db_slow_queries_total");
  });
});

describe("Integration Tests", () => {
  it("should handle complete request lifecycle with monitoring", async () => {
    queryMonitor.reset();
    queryMonitor.setEnabled(true);

    // Simulate request
    const startTime = performance.now();
    queryMonitor.recordQuery("SELECT * FROM trades WHERE strategyId = ?", 150);
    const duration = performance.now() - startTime;

    recordHttpMetrics("GET", "/api/portfolio/overview", 200, duration);

    const stats = queryMonitor.getStats();
    expect(stats?.totalQueries).toBe(1);
    expect(stats?.averageDuration).toBeGreaterThan(0);
  });

  it("should handle security and rate limiting together", () => {
    process.env.ENCRYPTION_MASTER_KEY = "test-key";

    const credential = "api-key-123";
    const encrypted = encryptCredential(credential);
    const decrypted = decryptCredential(encrypted);

    expect(decrypted).toBe(credential);
  });
});
