/**
 * Sentry Error Tracking Integration
 * 
 * Server-side Sentry setup for error monitoring, performance tracking,
 * and production debugging.
 */

import * as Sentry from '@sentry/node';
import { Request, Response, NextFunction } from 'express';

// Check if Sentry is configured
const SENTRY_DSN = process.env.SENTRY_DSN;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_SENTRY_ENABLED = !!SENTRY_DSN;

/**
 * Initialize Sentry for server-side error tracking
 */
export function initSentry() {
  if (!IS_SENTRY_ENABLED) {
    console.log('[Sentry] DSN not configured - error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    
    // Performance monitoring - sample 10% of transactions in production
    tracesSampleRate: IS_PRODUCTION ? 0.1 : 1.0,
    
    // Profile 10% of sampled transactions
    profilesSampleRate: IS_PRODUCTION ? 0.1 : 1.0,
    
    // Release tracking
    release: process.env.npm_package_version || 'unknown',
    
    // Server name for identifying instances
    serverName: process.env.HOSTNAME || 'sts-dashboard',
    
    // Filter sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-api-key'];
      }
      
      // Remove sensitive data from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
          if (breadcrumb.data) {
            // Remove any password or token fields
            const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'credentials'];
            sensitiveKeys.forEach(key => {
              if (breadcrumb.data && key in breadcrumb.data) {
                breadcrumb.data[key] = '[REDACTED]';
              }
            });
          }
          return breadcrumb;
        });
      }
      
      return event;
    },
    
    // Ignore certain errors
    ignoreErrors: [
      // Network errors that are expected
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      // User-caused errors
      'ResizeObserver loop limit exceeded',
      // Authentication errors (expected behavior)
      'UNAUTHORIZED',
      'Session expired',
    ],
    
    // Integrations
    integrations: [
      // HTTP integration for tracking outgoing requests
      Sentry.httpIntegration(),
      // Express integration
      Sentry.expressIntegration(),
    ],
  });

  console.log('[Sentry] Initialized successfully');
}

/**
 * Sentry request handler middleware
 * Must be the first middleware in the chain
 */
export function sentryRequestHandler() {
  if (!IS_SENTRY_ENABLED) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }
  // Return a middleware that adds request context to Sentry
  return (req: Request, _res: Response, next: NextFunction) => {
    Sentry.setContext('request', {
      method: req.method,
      url: req.url,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
      },
    });
    next();
  };
}

/**
 * Sentry error handler middleware
 * Must be after all other middleware and routes
 */
export function sentryErrorHandler() {
  if (!IS_SENTRY_ENABLED) {
    return (err: Error, _req: Request, _res: Response, next: NextFunction) => next(err);
  }
  return Sentry.expressErrorHandler();
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
export function setUser(user: { id: string; email?: string; username?: string } | null) {
  if (!IS_SENTRY_ENABLED) return;
  
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
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
 * Start a performance transaction
 */
export function startTransaction(name: string, op: string) {
  if (!IS_SENTRY_ENABLED) {
    return {
      finish: () => {},
      setStatus: () => {},
      startChild: () => ({ finish: () => {} }),
    };
  }
  
  return Sentry.startInactiveSpan({ name, op });
}

/**
 * Flush pending events before shutdown
 */
export async function flushSentry(timeout: number = 2000) {
  if (!IS_SENTRY_ENABLED) return;
  
  await Sentry.flush(timeout);
}

/**
 * Check if Sentry is enabled
 */
export function isSentryEnabled(): boolean {
  return IS_SENTRY_ENABLED;
}
