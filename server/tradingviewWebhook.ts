/**
 * TradingView Webhook Router
 *
 * Handles incoming webhook notifications from TradingView alerts.
 * Endpoint: POST /api/webhook/tradingview
 *
 * JSON Format for TradingView Alerts:
 * {
 *   "symbol": "NQTrend",           // Strategy symbol (required)
 *   "date": "{{timenow}}",         // Timestamp from TradingView
 *   "data": "{{strategy.order.action}}", // "buy", "sell", or "exit"
 *   "position": "{{strategy.market_position}}", // "long", "short", or "flat"
 *   "quantity": {{strategy.order.contracts}},   // Number of contracts
 *   "price": {{close}},            // Current price
 *   "token": "YOUR_SECRET_TOKEN",  // Authentication token
 *   "equityPercent": 2.5,          // Optional: % of equity to risk
 *   "contractSize": 1              // Optional: Contract multiplier
 * }
 */

import { Router, Request, Response } from "express";
import { processWebhook } from "./webhookService";
import { broadcastTradeNotification } from "./sseNotifications";

const router = Router();

/**
 * POST /api/webhook/tradingview
 *
 * Receives and processes TradingView webhook notifications
 */
router.post("/tradingview", async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Get client IP for logging
    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";

    console.log(
      `[TradingView Webhook] Received from ${ipAddress}:`,
      JSON.stringify(req.body).slice(0, 200)
    );

    // Process the webhook
    const result = await processWebhook(req.body, ipAddress);

    // Broadcast notification if successful trade
    if (result.success && result.tradeId) {
      const quantity = req.body.quantity || 1;
      const direction =
        req.body.direction || (req.body.data === "buy" ? "Long" : "Short");
      const signalType = result.signalType === "entry" ? "entry" : "exit";

      broadcastTradeNotification({
        type: signalType,
        strategySymbol: req.body.symbol,
        direction: direction as "Long" | "Short",
        price: parseFloat(req.body.price),
        pnl: signalType === "exit" ? req.body.pnl : undefined,
        timestamp: new Date(),
        tradeId: result.tradeId,
        message: `${signalType.toUpperCase()}: ${req.body.symbol} ${direction} @ ${req.body.price} (${quantity} contracts)`,
        positionSizing: {
          baseQuantity: quantity,
          userQuantity: quantity,
          contractType: "mini",
          accountValue: 100000,
          scalingFactor: 1,
          isLeveraged: false,
        },
      });
    }

    const processingTime = Date.now() - startTime;
    console.log(
      `[TradingView Webhook] Processed in ${processingTime}ms:`,
      result.message
    );

    // Return appropriate status code
    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        logId: result.logId,
        tradeId: result.tradeId,
        signalType: result.signalType,
        processingTimeMs: processingTime,
      });
    } else {
      // Use 400 for validation errors, 200 for duplicates
      const statusCode = result.error === "DUPLICATE" ? 200 : 400;
      res.status(statusCode).json({
        success: false,
        message: result.message,
        error: result.error,
        logId: result.logId,
        processingTimeMs: processingTime,
      });
    }
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error("[TradingView Webhook] Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
      processingTimeMs: processingTime,
    });
  }
});

/**
 * GET /api/webhook/tradingview/health
 *
 * Health check endpoint for webhook monitoring
 */
router.get("/tradingview/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    endpoint: "/api/webhook/tradingview",
  });
});

export default router;
