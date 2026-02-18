/**
 * Global Error Handler and Monitoring Utility
 * 
 * Provides centralized error handling, logging, and monitoring
 * for production-ready error tracking and user feedback.
 */

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface ErrorLog {
  timestamp: Date;
  message: string;
  stack?: string;
  context?: ErrorContext;
  severity: 'error' | 'warning' | 'info';
}

// In-memory error log (in production, this would go to a logging service)
const errorLogs: ErrorLog[] = [];
const MAX_LOGS = 100;

/**
 * Log an error with context
 */
export function logError(
  error: Error | string,
  context?: ErrorContext,
  severity: 'error' | 'warning' | 'info' = 'error'
): void {
  const errorLog: ErrorLog = {
    timestamp: new Date(),
    message: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
    context,
    severity,
  };

  // Add to in-memory log
  errorLogs.unshift(errorLog);
  if (errorLogs.length > MAX_LOGS) {
    errorLogs.pop();
  }

  // Console logging for development
  if (process.env.NODE_ENV !== 'production') {
    console.group(`[${severity.toUpperCase()}] ${errorLog.message}`);
    if (context) console.log('Context:', context);
    if (errorLog.stack) console.log('Stack:', errorLog.stack);
    console.groupEnd();
  }
}

/**
 * Get recent error logs
 */
export function getErrorLogs(): ErrorLog[] {
  return [...errorLogs];
}

/**
 * Clear error logs
 */
export function clearErrorLogs(): void {
  errorLogs.length = 0;
}

/**
 * User-friendly error messages for common error types
 */
export function getUserFriendlyMessage(error: Error | string): string {
  const message = error instanceof Error ? error.message : error;
  
  // Network errors
  if (message.includes('fetch') || message.includes('network') || message.includes('ECONNREFUSED')) {
    return 'Unable to connect to the server. Please check your internet connection and try again.';
  }
  
  // Authentication errors
  if (message.includes('unauthorized') || message.includes('401') || message.includes('authentication')) {
    return 'Your session has expired. Please log in again.';
  }
  
  // Permission errors
  if (message.includes('forbidden') || message.includes('403') || message.includes('permission')) {
    return 'You do not have permission to perform this action.';
  }
  
  // Not found errors
  if (message.includes('not found') || message.includes('404')) {
    return 'The requested resource could not be found.';
  }
  
  // Validation errors
  if (message.includes('validation') || message.includes('invalid')) {
    return 'Please check your input and try again.';
  }
  
  // Rate limiting
  if (message.includes('rate limit') || message.includes('429') || message.includes('too many')) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  
  // Server errors
  if (message.includes('500') || message.includes('server error') || message.includes('internal')) {
    return 'Something went wrong on our end. Please try again later.';
  }
  
  // Default message
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on certain errors
      if (
        lastError.message.includes('401') ||
        lastError.message.includes('403') ||
        lastError.message.includes('validation')
      ) {
        throw lastError;
      }
      
      // Wait before retrying
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    logError(`Failed to parse JSON: ${json.substring(0, 100)}...`, undefined, 'warning');
    return fallback;
  }
}

/**
 * Format error for display
 */
export function formatErrorForDisplay(error: unknown): string {
  if (error instanceof Error) {
    return getUserFriendlyMessage(error);
  }
  if (typeof error === 'string') {
    return getUserFriendlyMessage(error);
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return getUserFriendlyMessage(String((error as { message: unknown }).message));
  }
  return 'An unexpected error occurred.';
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('ECONNREFUSED') ||
      error.name === 'TypeError'
    );
  }
  return false;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Network errors are retryable
    if (isNetworkError(error)) return true;
    
    // Server errors (5xx) are retryable
    if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
      return true;
    }
    
    // Rate limiting is retryable
    if (error.message.includes('429') || error.message.includes('rate limit')) {
      return true;
    }
  }
  return false;
}
