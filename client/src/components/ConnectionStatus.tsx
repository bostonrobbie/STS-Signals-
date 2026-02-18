/**
 * Connection Status Component
 *
 * Provides visual feedback for connection state and handles offline scenarios
 */

import { useState, useEffect } from "react";
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { onConnectionChange, getConnectionState } from "@/lib/resilientFetch";

interface ConnectionStatusProps {
  /** Show as a banner at the top of the page */
  variant?: "banner" | "indicator" | "toast";
  /** Custom class name */
  className?: string;
}

export function ConnectionStatus({
  variant = "banner",
  className = "",
}: ConnectionStatusProps) {
  const [isOnline, setIsOnline] = useState(getConnectionState());
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Subscribe to connection changes
    const unsubscribe = onConnectionChange(online => {
      setIsOnline(online);
      if (!online) {
        setShowBanner(true);
      } else {
        // Hide banner after a delay when reconnected
        setTimeout(() => setShowBanner(false), 3000);
      }
      setIsReconnecting(false);
    });

    return unsubscribe;
  }, []);

  const handleRetry = async () => {
    setIsReconnecting(true);
    try {
      const response = await fetch("/api/live", {
        method: "HEAD",
        cache: "no-store",
      });
      if (response.ok) {
        setIsOnline(true);
        setTimeout(() => setShowBanner(false), 2000);
      }
    } catch {
      // Still offline
    }
    setIsReconnecting(false);
  };

  // Don't render if online and banner should be hidden
  if (isOnline && !showBanner) {
    return null;
  }

  if (variant === "indicator") {
    return (
      <div
        className={`flex items-center gap-2 ${className}`}
        title={isOnline ? "Connected" : "Connection lost"}
      >
        {isOnline ? (
          <Wifi className="h-4 w-4 text-green-500" />
        ) : (
          <WifiOff className="h-4 w-4 text-amber-500 animate-pulse" />
        )}
      </div>
    );
  }

  if (variant === "toast") {
    if (isOnline) return null;

    return (
      <div
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-black px-4 py-2 rounded-lg shadow-lg flex items-center gap-3 ${className}`}
      >
        <WifiOff className="h-4 w-4" />
        <span className="text-sm font-medium">Connection lost</span>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleRetry}
          disabled={isReconnecting}
          className="h-7 px-2"
        >
          {isReconnecting ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            "Retry"
          )}
        </Button>
      </div>
    );
  }

  // Banner variant (default)
  return (
    <div
      className={`w-full transition-all duration-300 ${
        showBanner ? "opacity-100" : "opacity-0 pointer-events-none"
      } ${className}`}
    >
      <div
        className={`px-4 py-2 flex items-center justify-center gap-3 text-sm ${
          isOnline
            ? "bg-green-500/10 text-green-500 border-b border-green-500/20"
            : "bg-amber-500/10 text-amber-500 border-b border-amber-500/20"
        }`}
      >
        {isOnline ? (
          <>
            <Wifi className="h-4 w-4" />
            <span>Connection restored</span>
          </>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4" />
            <span>Connection lost. Some features may be unavailable.</span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRetry}
              disabled={isReconnecting}
              className="h-7 px-2 ml-2 border-amber-500/30 hover:bg-amber-500/10"
            >
              {isReconnecting ? (
                <RefreshCw className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Retry
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Hook to get current connection state
 */
export function useConnectionStatus() {
  const [isOnline, setIsOnline] = useState(getConnectionState());

  useEffect(() => {
    const unsubscribe = onConnectionChange(setIsOnline);
    return unsubscribe;
  }, []);

  return { isOnline };
}

/**
 * Offline fallback wrapper component
 */
interface OfflineFallbackProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function OfflineFallback({ children, fallback }: OfflineFallbackProps) {
  const { isOnline } = useConnectionStatus();

  if (!isOnline && fallback) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
