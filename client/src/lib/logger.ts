/**
 * Frontend Logger Utility
 * Provides structured logging for the frontend application
 */

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : "";
    return `[${timestamp}] [${level}] ${message}${dataStr}`;
  }

  debug(message: string, data?: any) {
    if (this.isDevelopment) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, data));
    }
  }

  info(message: string, data?: any) {
    console.log(this.formatMessage(LogLevel.INFO, message, data));
  }

  warn(message: string, data?: any) {
    console.warn(this.formatMessage(LogLevel.WARN, message, data));
  }

  error(message: string, error?: any) {
    console.error(this.formatMessage(LogLevel.ERROR, message));
    if (error) {
      console.error(error);
    }
  }
}

export const logger = new Logger();

export default logger;
