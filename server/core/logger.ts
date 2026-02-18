/**
 * Simple logger that wraps console methods.
 * Provides a consistent logging interface across the application.
 */
export const logger = {
  info: (...args: unknown[]) => console.log("[INFO]", ...args),
  warn: (...args: unknown[]) => console.warn("[WARN]", ...args),
  error: (...args: unknown[]) => console.error("[ERROR]", ...args),
  debug: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== "production") {
      console.log("[DEBUG]", ...args);
    }
  },
};
