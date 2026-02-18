/**
 * Error Monitoring and Tracking System
 * Provides comprehensive error tracking, logging, and monitoring for the dashboard
 */

interface ErrorLog {
  id: string;
  timestamp: string;
  level: "error" | "warning" | "info";
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  url?: string;
  userAgent?: string;
}

class ErrorMonitoringService {
  private errorLogs: ErrorLog[] = [];
  private maxLogs = 100;
  private errorThresholds = {
    critical: 5, // 5 errors in 1 minute
    warning: 10, // 10 errors in 5 minutes
  };

  /**
   * Log an error with context
   */
  logError(
    message: string,
    error?: Error,
    context?: Record<string, unknown>
  ): void {
    const errorLog: ErrorLog = {
      id: `error-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
      level: "error",
      message,
      stack: error?.stack,
      context,
      url: typeof window !== "undefined" ? window.location.href : undefined,
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    };

    this.errorLogs.push(errorLog);
    this.trimLogs();

    // Send to server for persistent logging
    this.sendToServer(errorLog);

    // Check if we've exceeded error thresholds
    this.checkErrorThresholds();

    console.error(`[ErrorMonitoring] ${message}`, error, context);
  }

  /**
   * Log a warning
   */
  logWarning(message: string, context?: Record<string, unknown>): void {
    const warningLog: ErrorLog = {
      id: `warning-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
      level: "warning",
      message,
      context,
      url: typeof window !== "undefined" ? window.location.href : undefined,
    };

    this.errorLogs.push(warningLog);
    this.trimLogs();

    console.warn(`[ErrorMonitoring] ${message}`, context);
  }

  /**
   * Log info level messages
   */
  logInfo(message: string, context?: Record<string, unknown>): void {
    const infoLog: ErrorLog = {
      id: `info-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
      level: "info",
      message,
      context,
      url: typeof window !== "undefined" ? window.location.href : undefined,
    };

    this.errorLogs.push(infoLog);
    this.trimLogs();

    console.log(`[ErrorMonitoring] ${message}`, context);
  }

  /**
   * Get all error logs
   */
  getLogs(): ErrorLog[] {
    return [...this.errorLogs];
  }

  /**
   * Get errors from the last N minutes
   */
  getRecentErrors(minutes: number = 5): ErrorLog[] {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();
    return this.errorLogs.filter(
      log => log.level === "error" && log.timestamp > cutoffTime
    );
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.errorLogs = [];
  }

  /**
   * Check if error thresholds have been exceeded
   */
  private checkErrorThresholds(): void {
    const recentErrors = this.getRecentErrors(1); // Last 1 minute
    if (recentErrors.length >= this.errorThresholds.critical) {
      this.logWarning("Critical error threshold exceeded", {
        errorCount: recentErrors.length,
        threshold: this.errorThresholds.critical,
      });
    }
  }

  /**
   * Trim logs to max size
   */
  private trimLogs(): void {
    if (this.errorLogs.length > this.maxLogs) {
      this.errorLogs = this.errorLogs.slice(-this.maxLogs);
    }
  }

  /**
   * Send error to server for persistent logging
   */
  private async sendToServer(errorLog: ErrorLog): Promise<void> {
    try {
      // Only send in production
      if (process.env.NODE_ENV === "production") {
        await fetch("/api/monitoring/errors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(errorLog),
        });
      }
    } catch (err) {
      // Silently fail to avoid infinite error loops
      console.error("Failed to send error to server", err);
    }
  }

  /**
   * Get error statistics
   */
  getStatistics() {
    const stats = {
      totalErrors: this.errorLogs.filter(l => l.level === "error").length,
      totalWarnings: this.errorLogs.filter(l => l.level === "warning").length,
      totalInfo: this.errorLogs.filter(l => l.level === "info").length,
      recentErrors: this.getRecentErrors(5).length,
      errorsByUrl: {} as Record<string, number>,
    };

    // Count errors by URL
    this.errorLogs.forEach(log => {
      if (log.url) {
        stats.errorsByUrl[log.url] = (stats.errorsByUrl[log.url] || 0) + 1;
      }
    });

    return stats;
  }
}

// Export singleton instance
export const errorMonitoring = new ErrorMonitoringService();

/**
 * Global error handler for uncaught errors
 */
if (typeof window !== "undefined") {
  window.addEventListener("error", event => {
    errorMonitoring.logError(`Uncaught error: ${event.message}`, event.error, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // Handle unhandled promise rejections
  window.addEventListener("unhandledrejection", event => {
    errorMonitoring.logError(
      `Unhandled promise rejection: ${event.reason}`,
      event.reason instanceof Error ? event.reason : undefined,
      {
        reason: String(event.reason),
      }
    );
  });
}

export type { ErrorLog };
