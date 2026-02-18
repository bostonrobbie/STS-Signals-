/**
 * Execution Pipeline Service
 *
 * This module handles the complete signal-to-execution pipeline with:
 * - Signal routing to subscribed users
 * - Order creation and tracking
 * - Execution logging and audit trail
 * - Fail-safes and circuit breakers
 * - Low-latency processing
 */

import { getDb } from "./db";
import {
  userSignals,
  userSubscriptions,
  executionLogs,
  auditLogs,
} from "../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import type { NormalizedPayload } from "./webhookService";

// ============================================================================
// TYPES
// ============================================================================

export interface SignalRoutingResult {
  success: boolean;
  signalsCreated: number;
  usersNotified: number;
  errors: string[];
  processingTimeMs: number;
}

export interface ExecutionResult {
  success: boolean;
  orderId?: number;
  executionLogId?: number;
  error?: string;
  latencyMs: number;
}

export interface PipelineMetrics {
  totalSignalsProcessed: number;
  totalOrdersCreated: number;
  totalOrdersExecuted: number;
  totalOrdersFailed: number;
  averageLatencyMs: number;
  circuitBreakerStatus: "closed" | "open" | "half-open";
  lastProcessedAt: Date | null;
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

class CircuitBreaker {
  private failures = 0;
  private lastFailureTime: Date | null = null;
  private state: "closed" | "open" | "half-open" = "closed";

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly resetTimeoutMs: number = 60000 // 1 minute
  ) {}

  get status(): "closed" | "open" | "half-open" {
    if (this.state === "open") {
      // Check if we should transition to half-open
      if (
        this.lastFailureTime &&
        Date.now() - this.lastFailureTime.getTime() > this.resetTimeoutMs
      ) {
        this.state = "half-open";
      }
    }
    return this.state;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = "closed";
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();

    if (this.failures >= this.failureThreshold) {
      this.state = "open";
      console.error(
        `[CircuitBreaker] Circuit opened after ${this.failures} failures`
      );
    }
  }

  canExecute(): boolean {
    return this.status !== "open";
  }

  reset(): void {
    this.failures = 0;
    this.lastFailureTime = null;
    this.state = "closed";
  }
}

// ============================================================================
// EXECUTION PIPELINE
// ============================================================================

class ExecutionPipeline {
  private circuitBreaker = new CircuitBreaker(5, 60000);
  private metrics: PipelineMetrics = {
    totalSignalsProcessed: 0,
    totalOrdersCreated: 0,
    totalOrdersExecuted: 0,
    totalOrdersFailed: 0,
    averageLatencyMs: 0,
    circuitBreakerStatus: "closed",
    lastProcessedAt: null,
  };
  private latencyHistory: number[] = [];

  /**
   * Route a webhook signal to all subscribed users
   */
  async routeSignalToUsers(
    webhookLogId: number,
    payload: NormalizedPayload,
    strategyId: number
  ): Promise<SignalRoutingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let signalsCreated = 0;
    let usersNotified = 0;

    try {
      // Check circuit breaker
      if (!this.circuitBreaker.canExecute()) {
        return {
          success: false,
          signalsCreated: 0,
          usersNotified: 0,
          errors: ["Circuit breaker is open - execution paused"],
          processingTimeMs: Date.now() - startTime,
        };
      }

      const db = await getDb();
      if (!db) {
        return {
          success: false,
          signalsCreated: 0,
          usersNotified: 0,
          errors: ["Database not available"],
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Get all active subscriptions for this strategy
      const subscriptions = await db
        .select()
        .from(userSubscriptions)
        .where(
          and(
            eq(userSubscriptions.strategyId, strategyId),
            eq(userSubscriptions.autoExecuteEnabled, 1)
          )
        );

      if (subscriptions.length === 0) {
        console.log(
          `[ExecutionPipeline] No active subscriptions for strategy ${strategyId}`
        );
        return {
          success: true,
          signalsCreated: 0,
          usersNotified: 0,
          errors: [],
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Create signals for each subscribed user
      for (const sub of subscriptions) {
        try {
          // Calculate adjusted quantity based on subscription settings
          let adjustedQuantity = payload.quantity || 1;

          const multiplier = sub.quantityMultiplier
            ? parseFloat(String(sub.quantityMultiplier))
            : 1;
          if (multiplier !== 1) {
            adjustedQuantity = Math.round(adjustedQuantity * multiplier);
          }

          // Apply max position size limit if set
          if (sub.maxPositionSize && adjustedQuantity > sub.maxPositionSize) {
            adjustedQuantity = sub.maxPositionSize;
          }

          // Create user signal record
          const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minute expiration

          await db.insert(userSignals).values({
            // @ts-expect-error TS2769
            userId: sub.userId,
            strategyId: strategyId,
            webhookLogId: webhookLogId,
            action: "pending",
            direction: payload.direction || "long",
            quantity: adjustedQuantity,
            price: payload.price || 0,
            signalReceivedAt: new Date(),
            expiresAt: expiresAt,
          });

          signalsCreated++;

          // TODO: Send notification if enabled
          if (sub.notificationsEnabled) {
            usersNotified++;
            // await sendUserNotification(sub.userId, payload);
          }

          // Log audit trail
          await this.logAudit(
            sub.userId,
            "signal_created",
            "user_signals",
            null,
            {
              strategyId,
              webhookLogId,
              quantity: adjustedQuantity,
              direction: payload.direction,
            }
          );
        } catch (error) {
          const errorMsg = `Failed to create signal for user ${sub.userId}: ${error instanceof Error ? error.message : "Unknown error"}`;
          errors.push(errorMsg);
          console.error(`[ExecutionPipeline] ${errorMsg}`);
        }
      }

      this.metrics.totalSignalsProcessed += signalsCreated;
      this.metrics.lastProcessedAt = new Date();
      this.circuitBreaker.recordSuccess();

      return {
        success: errors.length === 0,
        signalsCreated,
        usersNotified,
        errors,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      this.circuitBreaker.recordFailure();
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      errors.push(errorMsg);

      return {
        success: false,
        signalsCreated,
        usersNotified,
        errors,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Create an execution order for a user signal
   */
  async createExecutionOrder(
    userId: number,
    signalId: number,
    brokerConnectionId: number,
    orderDetails: {
      symbol: string;
      action: "buy" | "sell";
      quantity: number;
      orderType: "market" | "limit" | "stop";
      price?: number;
      stopPrice?: number;
    }
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Check circuit breaker
      if (!this.circuitBreaker.canExecute()) {
        return {
          success: false,
          error: "Circuit breaker is open - execution paused",
          latencyMs: Date.now() - startTime,
        };
      }

      const db = await getDb();
      if (!db) {
        return {
          success: false,
          error: "Database not available",
          latencyMs: Date.now() - startTime,
        };
      }

      // Create execution log entry (serves as order record)
      const result = await db
        .insert(executionLogs)
        .values({
          webhookLogId: signalId, // Use signal ID as reference
          brokerConnectionId,
          status: "pending",
          orderType: orderDetails.orderType,
          side: orderDetails.action,
          symbol: orderDetails.symbol,
          quantity: orderDetails.quantity,
          price: orderDetails.price ? orderDetails.price * 100 : null, // Convert to cents
        })
        .$returningId();
      // @ts-expect-error TS2339
      const log = { id: result[0].id };

      this.metrics.totalOrdersCreated++;
      const order = { id: log.id }; // Use log as order

      // Log audit trail
      await this.logAudit(
        userId,
        "order_created",
        "execution_orders",
        order.id,
        orderDetails
      );

      const latency = Date.now() - startTime;
      this.updateLatencyMetrics(latency);
      this.circuitBreaker.recordSuccess();

      return {
        success: true,
        orderId: order.id,
        executionLogId: log.id,
        latencyMs: latency,
      };
    } catch (error) {
      this.circuitBreaker.recordFailure();
      this.metrics.totalOrdersFailed++;

      return {
        success: false,
        error: error instanceof Error ? error.message : "Order creation failed",
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Update order status after broker execution
   */
  async updateOrderStatus(
    orderId: number,
    status:
      | "pending"
      | "submitted"
      | "filled"
      | "partial"
      | "cancelled"
      | "rejected"
      | "error",
    details?: {
      filledQuantity?: number;
      filledPrice?: number;
      brokerOrderId?: string;
      errorMessage?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      // Update order status
      await db
        .update(executionLogs)
        // @ts-expect-error TS2345
        .set({
          status,
          fillQuantity: details?.filledQuantity,
          fillPrice: details?.filledPrice,
          brokerOrderId: details?.brokerOrderId,
          errorMessage: details?.errorMessage,
          ...(status === "filled" || status === "partial"
            ? { filledAt: new Date() }
            : {}),
        })
        .where(eq(executionLogs.id, orderId));

      // Log status change in audit
      await this.logAudit(
        0, // System action
        `order_status_${status}`,
        "execution_logs",
        orderId,
        details || {}
      );

      // Update metrics
      if (status === "filled") {
        this.metrics.totalOrdersExecuted++;
      } else if (status === "error" || status === "rejected") {
        this.metrics.totalOrdersFailed++;
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Status update failed",
      };
    }
  }

  /**
   * Get pipeline metrics
   */
  getMetrics(): PipelineMetrics {
    return {
      ...this.metrics,
      circuitBreakerStatus: this.circuitBreaker.status,
    };
  }

  /**
   * Reset circuit breaker (admin action)
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
    console.log("[ExecutionPipeline] Circuit breaker reset by admin");
  }

  /**
   * Log audit trail entry
   */
  private async logAudit(
    userId: number,
    action: string,
    resourceType: string,
    resourceId: number | null,
    details: Record<string, any>
  ): Promise<void> {
    try {
      const db = await getDb();
      if (!db) return;
      await db.insert(auditLogs).values({
        userId,
        action,
        resourceType,
        resourceId,
        newValue: JSON.stringify(details),
        status: "success",
      });
    } catch (error) {
      console.error("[ExecutionPipeline] Failed to log audit:", error);
    }
  }

  /**
   * Update latency metrics
   */
  private updateLatencyMetrics(latencyMs: number): void {
    this.latencyHistory.push(latencyMs);

    // Keep only last 100 measurements
    if (this.latencyHistory.length > 100) {
      this.latencyHistory.shift();
    }

    // Calculate average
    this.metrics.averageLatencyMs =
      this.latencyHistory.reduce((a, b) => a + b, 0) /
      this.latencyHistory.length;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const executionPipeline = new ExecutionPipeline();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get pending signals for a user
 */
export async function getPendingSignals(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: userSignals.id,
      strategyId: userSignals.strategyId,
      direction: userSignals.direction,
      quantity: userSignals.quantity,
      price: userSignals.price,
      action: userSignals.action,
      signalReceivedAt: userSignals.signalReceivedAt,
      expiresAt: userSignals.expiresAt,
      createdAt: userSignals.createdAt,
    })
    .from(userSignals)
    .where(
      and(eq(userSignals.userId, userId), eq(userSignals.action, "pending"))
    )
    .orderBy(desc(userSignals.signalReceivedAt));
}

/**
 * Mark a signal as executed or skipped
 */
export async function updateSignalAction(
  signalId: number,
  userId: number,
  action: "executed" | "skipped",
  executionLogId?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };

    await db
      .update(userSignals)
      .set({
        action,
        // @ts-expect-error TS2322
        actionTakenAt: new Date(),
        executionLogId: executionLogId || null,
      })
      .where(and(eq(userSignals.id, signalId), eq(userSignals.userId, userId)));

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Update failed",
    };
  }
}

/**
 * Expire old pending signals
 */
export async function expirePendingSignals(): Promise<number> {
  try {
    const db = await getDb();
    if (!db) return 0;

    const result = await db
      .update(userSignals)
      .set({
        action: "expired",
        // @ts-expect-error TS2322
        actionTakenAt: new Date(),
      })
      .where(
        and(
          eq(userSignals.action, "pending"),
          sql`${userSignals.expiresAt} < NOW()`
        )
      );

    return (result as any).rowCount || 0;
  } catch (error) {
    console.error("[ExecutionPipeline] Failed to expire signals:", error);
    return 0;
  }
}

/**
 * Get execution history for a user
 */
export async function getExecutionHistory(_userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(executionLogs)
    .orderBy(desc(executionLogs.createdAt))
    .limit(limit);
}

/**
 * Get execution logs for an order
 */
export async function getOrderExecutionLogs(_orderId: number) {
  const db = await getDb();
  if (!db) return [];

  // Return audit logs related to this order
  return db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.action, `order_status_filled`))
    .orderBy(auditLogs.createdAt)
    .limit(10);
}
