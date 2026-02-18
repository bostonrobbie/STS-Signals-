/**
 * Webhook URL Monitoring Service
 *
 * This service monitors the webhook URL configuration and alerts the owner
 * if the URL changes unexpectedly. This is critical because TradingView
 * alerts are configured with a specific URL and will fail if it changes.
 */

import { notifyOwner } from "./_core/notification";

// The expected stable webhook URL - this should match what's configured in TradingView
const EXPECTED_WEBHOOK_DOMAIN = "stsdashboard.com";
const EXPECTED_WEBHOOK_PATH = "/api/webhook/tradingview";
const EXPECTED_WEBHOOK_URL = `https://${EXPECTED_WEBHOOK_DOMAIN}${EXPECTED_WEBHOOK_PATH}`;

// Store the last known URL to detect changes
let lastKnownUrl: string | null = null;
let lastCheckTime: Date | null = null;
let alertSentForCurrentMismatch = false;

interface WebhookUrlCheckResult {
  isCorrect: boolean;
  currentUrl: string;
  expectedUrl: string;
  domain: string;
  expectedDomain: string;
  mismatchType: "none" | "domain" | "path" | "protocol";
}

/**
 * Check if the current webhook URL matches the expected stable URL
 */
export function checkWebhookUrl(currentUrl: string): WebhookUrlCheckResult {
  const result: WebhookUrlCheckResult = {
    isCorrect: true,
    currentUrl,
    expectedUrl: EXPECTED_WEBHOOK_URL,
    domain: "",
    expectedDomain: EXPECTED_WEBHOOK_DOMAIN,
    mismatchType: "none",
  };

  try {
    const url = new URL(currentUrl);
    result.domain = url.hostname;

    // Check protocol
    if (url.protocol !== "https:") {
      result.isCorrect = false;
      result.mismatchType = "protocol";
      return result;
    }

    // Check domain
    if (url.hostname !== EXPECTED_WEBHOOK_DOMAIN) {
      result.isCorrect = false;
      result.mismatchType = "domain";
      return result;
    }

    // Check path
    if (url.pathname !== EXPECTED_WEBHOOK_PATH) {
      result.isCorrect = false;
      result.mismatchType = "path";
      return result;
    }
  } catch (error) {
    result.isCorrect = false;
    result.mismatchType = "domain";
  }

  return result;
}

/**
 * Monitor the webhook URL and alert if it changes
 * This should be called periodically or on startup
 */
export async function monitorWebhookUrl(currentUrl: string): Promise<void> {
  const checkResult = checkWebhookUrl(currentUrl);
  lastCheckTime = new Date();

  // If URL changed from last known value
  if (lastKnownUrl !== null && lastKnownUrl !== currentUrl) {
    console.warn(
      `[WebhookMonitor] URL changed from ${lastKnownUrl} to ${currentUrl}`
    );

    // Send alert about the change
    await notifyOwner({
      title: "⚠️ Webhook URL Changed!",
      content:
        `The webhook URL has changed unexpectedly.\n\n` +
        `**Previous URL:** ${lastKnownUrl}\n` +
        `**Current URL:** ${currentUrl}\n` +
        `**Expected URL:** ${EXPECTED_WEBHOOK_URL}\n\n` +
        `If you have TradingView alerts configured with the old URL, they may stop working.\n` +
        `Please verify your TradingView webhook configuration.`,
    });

    alertSentForCurrentMismatch = false; // Reset so we can alert about mismatch too
  }

  // If current URL doesn't match expected
  if (!checkResult.isCorrect && !alertSentForCurrentMismatch) {
    console.error(
      `[WebhookMonitor] URL mismatch detected: ${checkResult.mismatchType}`
    );

    await notifyOwner({
      title: "🚨 Webhook URL Mismatch Detected!",
      content:
        `The webhook URL does not match the expected stable URL.\n\n` +
        `**Current URL:** ${currentUrl}\n` +
        `**Expected URL:** ${EXPECTED_WEBHOOK_URL}\n` +
        `**Mismatch Type:** ${checkResult.mismatchType}\n\n` +
        `**Action Required:** Update your TradingView alerts to use the expected URL, ` +
        `or update the WEBHOOK_BASE_URL environment variable if the URL has intentionally changed.`,
    });

    alertSentForCurrentMismatch = true;
  }

  lastKnownUrl = currentUrl;
}

/**
 * Get the current monitoring status
 */
export function getMonitoringStatus(): {
  lastKnownUrl: string | null;
  lastCheckTime: Date | null;
  expectedUrl: string;
  expectedDomain: string;
  alertSent: boolean;
} {
  return {
    lastKnownUrl,
    lastCheckTime,
    expectedUrl: EXPECTED_WEBHOOK_URL,
    expectedDomain: EXPECTED_WEBHOOK_DOMAIN,
    alertSent: alertSentForCurrentMismatch,
  };
}

/**
 * Reset the alert flag (useful after user acknowledges the issue)
 */
export function resetAlertFlag(): void {
  alertSentForCurrentMismatch = false;
}

/**
 * Get the expected webhook URL
 */
export function getExpectedWebhookUrl(): string {
  return EXPECTED_WEBHOOK_URL;
}

/**
 * Get the expected webhook domain
 */
export function getExpectedWebhookDomain(): string {
  return EXPECTED_WEBHOOK_DOMAIN;
}
