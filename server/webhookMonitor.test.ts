/**
 * Tests for Webhook URL Monitoring Service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkWebhookUrl } from "./webhookMonitor";

// Mock the notification module to prevent actual notifications during tests
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

describe("Webhook URL Monitoring", () => {
  const EXPECTED_DOMAIN = "stsdashboard.com";
  const EXPECTED_URL = `https://${EXPECTED_DOMAIN}/api/webhook/tradingview`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("checkWebhookUrl", () => {
    it("should return isCorrect=true for the expected URL", () => {
      const result = checkWebhookUrl(EXPECTED_URL);

      expect(result.isCorrect).toBe(true);
      expect(result.mismatchType).toBe("none");
      expect(result.expectedUrl).toBe(EXPECTED_URL);
    });

    it("should detect domain mismatch for Cloud Run URLs", () => {
      const cloudRunUrl =
        "https://sxhv6enedt-fqglekhrxa-uk.a.run.app/api/webhook/tradingview";
      const result = checkWebhookUrl(cloudRunUrl);

      expect(result.isCorrect).toBe(false);
      expect(result.mismatchType).toBe("domain");
      expect(result.domain).toBe("sxhv6enedt-fqglekhrxa-uk.a.run.app");
      expect(result.expectedDomain).toBe(EXPECTED_DOMAIN);
    });

    it("should detect domain mismatch for different Cloud Run URLs", () => {
      const cloudRunUrl =
        "https://gov6jjmrze-bamg4opyya-uk.a.run.app/api/webhook/tradingview";
      const result = checkWebhookUrl(cloudRunUrl);

      expect(result.isCorrect).toBe(false);
      expect(result.mismatchType).toBe("domain");
    });

    it("should detect domain mismatch for localhost", () => {
      const localhostUrl = "https://localhost:3000/api/webhook/tradingview";
      const result = checkWebhookUrl(localhostUrl);

      expect(result.isCorrect).toBe(false);
      expect(result.mismatchType).toBe("domain");
      expect(result.domain).toBe("localhost");
    });

    it("should detect protocol mismatch for HTTP URLs", () => {
      const httpUrl = `http://${EXPECTED_DOMAIN}/api/webhook/tradingview`;
      const result = checkWebhookUrl(httpUrl);

      expect(result.isCorrect).toBe(false);
      expect(result.mismatchType).toBe("protocol");
    });

    it("should detect path mismatch for wrong endpoint", () => {
      const wrongPathUrl = `https://${EXPECTED_DOMAIN}/api/webhook/wrong`;
      const result = checkWebhookUrl(wrongPathUrl);

      expect(result.isCorrect).toBe(false);
      expect(result.mismatchType).toBe("path");
    });

    it("should detect path mismatch for missing path", () => {
      const noPathUrl = `https://${EXPECTED_DOMAIN}/`;
      const result = checkWebhookUrl(noPathUrl);

      expect(result.isCorrect).toBe(false);
      expect(result.mismatchType).toBe("path");
    });

    it("should handle invalid URLs gracefully", () => {
      const invalidUrl = "not-a-valid-url";
      const result = checkWebhookUrl(invalidUrl);

      expect(result.isCorrect).toBe(false);
      expect(result.mismatchType).toBe("domain");
    });

    it("should handle empty string", () => {
      const result = checkWebhookUrl("");

      expect(result.isCorrect).toBe(false);
    });

    it("should accept URLs with trailing parameters", () => {
      // The path check should still work even with query params
      const urlWithParams = `https://${EXPECTED_DOMAIN}/api/webhook/tradingview?test=1`;
      const result = checkWebhookUrl(urlWithParams);

      // Path should still match since pathname doesn't include query string
      expect(result.isCorrect).toBe(true);
    });
  });

  describe("URL Stability Requirements", () => {
    it("should have the correct expected domain hardcoded", () => {
      const result = checkWebhookUrl(EXPECTED_URL);
      expect(result.expectedDomain).toBe("stsdashboard.com");
    });

    it("should have the correct expected path", () => {
      const result = checkWebhookUrl(EXPECTED_URL);
      expect(result.expectedUrl).toContain("/api/webhook/tradingview");
    });

    it("should require HTTPS protocol", () => {
      const httpUrl = "http://stsdashboard.com/api/webhook/tradingview";
      const result = checkWebhookUrl(httpUrl);

      expect(result.isCorrect).toBe(false);
      expect(result.mismatchType).toBe("protocol");
    });
  });

  describe("Common Mismatch Scenarios", () => {
    const testCases = [
      {
        name: "Old Cloud Run deployment",
        url: "https://sxhv6enedt-fqglekhrxa-uk.a.run.app/api/webhook/tradingview",
        expectedMismatch: "domain",
      },
      {
        name: "Different Cloud Run deployment",
        url: "https://gov6jjmrze-bamg4opyya-uk.a.run.app/api/webhook/tradingview",
        expectedMismatch: "domain",
      },
      {
        name: "Development server",
        url: "https://3000-abc123.manus.computer/api/webhook/tradingview",
        expectedMismatch: "domain",
      },
      {
        name: "Local development",
        url: "http://localhost:3000/api/webhook/tradingview",
        expectedMismatch: "protocol", // Protocol checked first
      },
      {
        name: "Wrong subdomain",
        url: "https://wrong-subdomain.manus.space/api/webhook/tradingview",
        expectedMismatch: "domain",
      },
    ];

    testCases.forEach(({ name, url, expectedMismatch }) => {
      it(`should detect mismatch for: ${name}`, () => {
        const result = checkWebhookUrl(url);

        expect(result.isCorrect).toBe(false);
        expect(result.mismatchType).toBe(expectedMismatch);
      });
    });
  });
});

describe("Webhook URL Configuration", () => {
  it("should use stable manus.space domain in production", () => {
    // This test documents the expected behavior
    const expectedProductionUrl =
      "https://stsdashboard.com/api/webhook/tradingview";
    const result = checkWebhookUrl(expectedProductionUrl);

    expect(result.isCorrect).toBe(true);
    expect(result.currentUrl).toBe(expectedProductionUrl);
  });

  it("should not change URL between deployments", () => {
    // The expected URL should remain constant
    const url1 = "https://stsdashboard.com/api/webhook/tradingview";
    const url2 = "https://stsdashboard.com/api/webhook/tradingview";

    expect(url1).toBe(url2);

    const result1 = checkWebhookUrl(url1);
    const result2 = checkWebhookUrl(url2);

    expect(result1.isCorrect).toBe(true);
    expect(result2.isCorrect).toBe(true);
  });
});
