/**
 * Sentry Client-Side Integration
 * 
 * React/Browser-side Sentry setup for error tracking,
 * performance monitoring, and user session replay.
 */

import * as Sentry from '@sentry/react';

// Get DSN from environment (Vite exposes VITE_ prefixed vars)
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const IS_PRODUCTION = import.meta.env.PROD;
const IS_SENTRY_ENABLED = !!SENTRY_DSN;

/**
 * Initialize Sentry for client-side error tracking
 */
export function initSentry() {
  if (!IS_SENTRY_ENABLED) {
    console.log('[Sentry] Client DSN not configured - error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: IS_PRODUCTION ? 'production' : 'development',
    
    // Performance monitoring
    tracesSampleRate: IS_PRODUCTION ? 0.1 : 1.0,
    
    // Session replay - capture 10% of sessions, 100% of error sessions
    replaysSessionSampleRate: IS_PRODUCTION ? 0.1 : 0,
    replaysOnErrorSampleRate: IS_PRODUCTION ? 1.0 : 0,
    
    // Release tracking
    release: import.meta.env.VITE_APP_VERSION || 'unknown',
    
    // Filter sensitive data
    beforeSend(event) {
      // Remove sensitive URL parameters
      if (event.request?.url) {
        const url = new URL(event.request.url);
        ['token', 'key', 'secret', 'password'].forEach(param => {
          if (url.searchParams.has(param)) {
            url.searchParams.set(param, '[REDACTED]');
          }
        });
        event.request.url = url.toString();
      }
      
      return event;
    },
    
    // Ignore certain errors
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'originalCreateNotification',
      'canvas.contentDocument',
      'MyApp_RemoveAllHighlights',
      'http://tt.teletrader.com/',
      'jigsaw is not defined',
      'ComboSearch is not defined',
      'http://loading.retry.widdit.com/',
      'atomicFindClose',
      // Facebook borance
      'fb_xd_fragment',
      // ISP "optimizations"
      'bmi_SafeAddOnload',
      'EBCallBackMessageReceived',
      // Network errors
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      'NetworkError',
      'AbortError',
      // Resize observer
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // User navigation
      'Navigation cancelled',
      // Auth errors (expected)
      'UNAUTHORIZED',
      'Session expired',
    ],
    
    // Deny URLs from being tracked
    denyUrls: [
      // Chrome extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
      // Firefox extensions
      /^moz-extension:\/\//i,
      // Safari extensions
      /^safari-extension:\/\//i,
      // Other
      /^resource:\/\//i,
    ],
    
    integrations: [
      // Browser tracing for performance
      Sentry.browserTracingIntegration(),
      // Replay for session recording (production only)
      ...(IS_PRODUCTION ? [Sentry.replayIntegration()] : []),
    ],
  });

  console.log('[Sentry] Client initialized successfully');
}

/**
 * Capture an exception with additional context
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (!IS_SENTRY_ENABLED) {
    console.error('[Error]', error.message, context);
    return;
  }

  Sentry.withScope(scope => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureException(error);
  });
}

/**
 * Capture a message with severity level
 */
export function captureMessage(
  message: string, 
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: Record<string, any>
) {
  if (!IS_SENTRY_ENABLED) {
    console.log(`[${level.toUpperCase()}]`, message, context);
    return;
  }

  Sentry.withScope(scope => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureMessage(message, level);
  });
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string; email?: string; name?: string } | null) {
  if (!IS_SENTRY_ENABLED) return;
  
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.name,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, any>,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'
) {
  if (!IS_SENTRY_ENABLED) return;
  
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Set a tag for filtering in Sentry dashboard
 */
export function setTag(key: string, value: string) {
  if (!IS_SENTRY_ENABLED) return;
  Sentry.setTag(key, value);
}

/**
 * Create an error boundary wrapper component
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

/**
 * HOC to wrap components with error boundary
 */
export const withSentryErrorBoundary = Sentry.withErrorBoundary;

/**
 * Check if Sentry is enabled
 */
export function isSentryEnabled(): boolean {
  return IS_SENTRY_ENABLED;
}
