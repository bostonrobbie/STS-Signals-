/**
 * Error Tracking Hook
 * 
 * Provides error tracking and reporting functionality for React components.
 * Captures errors with context and provides user-friendly feedback.
 */

import { useCallback, useEffect } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { logError, formatErrorForDisplay, ErrorContext } from '@/lib/errorHandler';
import { toast } from 'sonner';

interface UseErrorTrackingOptions {
  component: string;
  showToast?: boolean;
}

export function useErrorTracking({ component, showToast = true }: UseErrorTrackingOptions) {
  const { user } = useAuth();

  // Track errors with context
  const trackError = useCallback(
    (error: Error | string, action?: string, metadata?: Record<string, unknown>) => {
      const context: ErrorContext = {
        component,
        action,
        userId: user?.id?.toString(),
        metadata: {
          ...metadata,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };

      logError(error, context, 'error');

      if (showToast) {
        const message = formatErrorForDisplay(error);
        toast.error(message);
      }
    },
    [component, user?.id, showToast, toast]
  );

  // Track warnings
  const trackWarning = useCallback(
    (message: string, action?: string, metadata?: Record<string, unknown>) => {
      const context: ErrorContext = {
        component,
        action,
        userId: user?.id?.toString(),
        metadata,
      };

      logError(message, context, 'warning');
    },
    [component, user?.id]
  );

  // Track API errors from tRPC
  const trackApiError = useCallback(
    (error: unknown, queryName: string) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      trackError(errorMessage, `API Query: ${queryName}`, {
        queryName,
        errorType: error instanceof Error ? error.name : 'Unknown',
      });
    },
    [trackError]
  );

  // Set up global error handler for unhandled errors in this component
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      trackError(event.error || event.message, 'Unhandled Error', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      trackError(
        event.reason instanceof Error ? event.reason : String(event.reason),
        'Unhandled Promise Rejection'
      );
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [trackError]);

  return {
    trackError,
    trackWarning,
    trackApiError,
  };
}

// Note: For HOC pattern, import this hook directly in components instead
// Example: const { trackError, trackApiError } = useErrorTracking({ component: 'MyComponent' });
