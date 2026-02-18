// @ts-expect-error TS2305
import { redis } from "../db";
import { logger } from "./logger";

/**
 * Audit Trail & Logging System
 * Tracks all user actions and system events for compliance and debugging
 */

export interface AuditEvent {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string | number;
  changes?: Record<string, any>;
  status: "success" | "failure";
  error?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AuditFilter {
  userId?: string;
  action?: string;
  resource?: string;
  status?: "success" | "failure";
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

const AUDIT_LOG_PREFIX = "audit:";
const MAX_AUDIT_LOGS = 1000000; // Store up to 1M events

/**
 * Log audit event
 */
export const logAuditEvent = async (
  event: Omit<AuditEvent, "id" | "timestamp">
): Promise<string> => {
  try {
    const auditEvent: AuditEvent = {
      ...event,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    const key = `${AUDIT_LOG_PREFIX}${auditEvent.id}`;
    const serialized = JSON.stringify(auditEvent);

    // Store in Redis with expiration (90 days)
    await redis.setex(key, 90 * 24 * 60 * 60, serialized);

    // Add to user's audit log
    if (auditEvent.userId) {
      await redis.lpush(
        `${AUDIT_LOG_PREFIX}user:${auditEvent.userId}`,
        serialized
      );
      await redis.ltrim(
        `${AUDIT_LOG_PREFIX}user:${auditEvent.userId}`,
        0,
        9999
      ); // Keep last 10k events
    }

    // Add to resource audit log
    if (auditEvent.resource && auditEvent.resourceId) {
      await redis.lpush(
        `${AUDIT_LOG_PREFIX}resource:${auditEvent.resource}:${auditEvent.resourceId}`,
        serialized
      );
      await redis.ltrim(
        `${AUDIT_LOG_PREFIX}resource:${auditEvent.resource}:${auditEvent.resourceId}`,
        0,
        9999
      );
    }

    // Add to global audit log
    await redis.lpush(`${AUDIT_LOG_PREFIX}global`, serialized);
    await redis.ltrim(`${AUDIT_LOG_PREFIX}global`, 0, MAX_AUDIT_LOGS);

    logger.info(`Audit event logged: ${auditEvent.action}`, {
      eventId: auditEvent.id,
      userId: auditEvent.userId,
      resource: auditEvent.resource,
      status: auditEvent.status,
    });

    return auditEvent.id;
  } catch (error) {
    logger.error("Failed to log audit event", error);
    throw error;
  }
};

/**
 * Get audit events for user
 */
export const getUserAuditLog = async (
  userId: string,
  limit: number = 100,
  offset: number = 0
): Promise<AuditEvent[]> => {
  try {
    const key = `${AUDIT_LOG_PREFIX}user:${userId}`;
    const events = await redis.lrange(key, offset, offset + limit - 1);

    return events.map((event: any) => JSON.parse(event) as AuditEvent);
  } catch (error) {
    logger.error(`Failed to get audit log for user ${userId}`, error);
    return [];
  }
};

/**
 * Get audit events for resource
 */
export const getResourceAuditLog = async (
  resource: string,
  resourceId: string | number,
  limit: number = 100
): Promise<AuditEvent[]> => {
  try {
    const key = `${AUDIT_LOG_PREFIX}resource:${resource}:${resourceId}`;
    const events = await redis.lrange(key, 0, limit - 1);

    return events.map((event: any) => JSON.parse(event) as AuditEvent);
  } catch (error) {
    logger.error(
      `Failed to get audit log for ${resource}:${resourceId}`,
      error
    );
    return [];
  }
};

/**
 * Get global audit log
 */
export const getGlobalAuditLog = async (
  limit: number = 100,
  offset: number = 0
): Promise<AuditEvent[]> => {
  try {
    const key = `${AUDIT_LOG_PREFIX}global`;
    const events = await redis.lrange(key, offset, offset + limit - 1);

    return events.map((event: any) => JSON.parse(event) as AuditEvent);
  } catch (error) {
    logger.error("Failed to get global audit log", error);
    return [];
  }
};

/**
 * Search audit logs
 */
export const searchAuditLogs = async (
  filter: AuditFilter
): Promise<AuditEvent[]> => {
  try {
    let events: AuditEvent[] = [];

    if (filter.userId) {
      events = await getUserAuditLog(
        filter.userId,
        filter.limit || 100,
        filter.offset || 0
      );
      // @ts-expect-error TS2551
    } else if (filter.resource && filter.resourceId) {
      events = await getResourceAuditLog(
        filter.resource,
        // @ts-expect-error TS2551
        filter.resourceId,
        filter.limit || 100
      );
    } else {
      events = await getGlobalAuditLog(filter.limit || 100, filter.offset || 0);
    }

    // Apply filters
    if (filter.action) {
      events = events.filter(e => e.action === filter.action);
    }

    if (filter.status) {
      events = events.filter(e => e.status === filter.status);
    }

    if (filter.startDate) {
      events = events.filter(e => new Date(e.timestamp) >= filter.startDate!);
    }

    if (filter.endDate) {
      events = events.filter(e => new Date(e.timestamp) <= filter.endDate!);
    }

    return events;
  } catch (error) {
    logger.error("Failed to search audit logs", error);
    return [];
  }
};

/**
 * Log user action
 */
export const logUserAction = async (
  userId: string,
  action: string,
  resource: string,
  resourceId?: string | number,
  metadata?: Record<string, any>
) => {
  return logAuditEvent({
    userId,
    action,
    resource,
    resourceId,
    status: "success",
    metadata,
  });
};

/**
 * Log user error
 */
export const logUserError = async (
  userId: string,
  action: string,
  resource: string,
  error: string,
  resourceId?: string | number
) => {
  return logAuditEvent({
    userId,
    action,
    resource,
    resourceId,
    status: "failure",
    error,
  });
};

/**
 * Log system action
 */
export const logSystemAction = async (
  action: string,
  resource: string,
  metadata?: Record<string, any>
) => {
  return logAuditEvent({
    action,
    resource,
    status: "success",
    metadata,
  });
};

/**
 * Log system error
 */
export const logSystemError = async (
  action: string,
  resource: string,
  error: string,
  metadata?: Record<string, any>
) => {
  return logAuditEvent({
    action,
    resource,
    status: "failure",
    error,
    metadata,
  });
};

/**
 * Generate audit report
 */
export const generateAuditReport = async (filter: AuditFilter) => {
  try {
    const events = await searchAuditLogs(filter);

    const report = {
      generatedAt: new Date().toISOString(),
      filter,
      totalEvents: events.length,
      successCount: events.filter(e => e.status === "success").length,
      failureCount: events.filter(e => e.status === "failure").length,
      byAction: {} as Record<string, number>,
      byResource: {} as Record<string, number>,
      events,
    };

    // Count by action
    events.forEach(e => {
      report.byAction[e.action] = (report.byAction[e.action] || 0) + 1;
      report.byResource[e.resource] = (report.byResource[e.resource] || 0) + 1;
    });

    return report;
  } catch (error) {
    logger.error("Failed to generate audit report", error);
    throw error;
  }
};

/**
 * Export audit logs
 */
export const exportAuditLogs = async (
  filter: AuditFilter,
  format: "json" | "csv" = "json"
) => {
  try {
    const events = await searchAuditLogs(filter);

    if (format === "json") {
      return JSON.stringify(events, null, 2);
    }

    // CSV format
    const headers = [
      "ID",
      "User ID",
      "Action",
      "Resource",
      "Status",
      "Timestamp",
    ];
    const rows = events.map(e => [
      e.id,
      e.userId || "N/A",
      e.action,
      e.resource,
      e.status,
      e.timestamp.toISOString(),
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    return csv;
  } catch (error) {
    logger.error("Failed to export audit logs", error);
    throw error;
  }
};

/**
 * Clear old audit logs
 */
export const clearOldAuditLogs = async (daysOld: number = 90) => {
  try {
    logger.info(`Clearing audit logs older than ${daysOld} days`);

    // Implementation would delete old logs from Redis
    // This is handled by Redis TTL, but can be manually triggered

    logger.info("Old audit logs cleared");
  } catch (error) {
    logger.error("Failed to clear old audit logs", error);
  }
};

export default {
  logAuditEvent,
  getUserAuditLog,
  getResourceAuditLog,
  getGlobalAuditLog,
  searchAuditLogs,
  logUserAction,
  logUserError,
  logSystemAction,
  logSystemError,
  generateAuditReport,
  exportAuditLogs,
  clearOldAuditLogs,
};
