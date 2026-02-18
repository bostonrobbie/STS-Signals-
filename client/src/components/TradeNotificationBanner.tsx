import { useTradeNotifications } from "@/contexts/TradeNotificationContext";
import {
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  X,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatNYTime } from "@/lib/timezone";
import { useState, useEffect } from "react";

export function TradeNotificationBanner() {
  const {
    isConnected,
    latestNotification,
    notifications,
    unreadCount,
    markAllAsRead,
    clearNotifications,
    soundEnabled,
    setSoundEnabled,
  } = useTradeNotifications();

  const [showBanner, setShowBanner] = useState(false);
  const [bannerNotification, setBannerNotification] =
    useState(latestNotification);

  // Show banner when new notification arrives
  useEffect(() => {
    if (latestNotification) {
      setBannerNotification(latestNotification);
      setShowBanner(true);

      // Auto-hide after 15 seconds
      const timer = setTimeout(() => {
        setShowBanner(false);
      }, 15000);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [latestNotification]);

  const dismissBanner = () => {
    setShowBanner(false);
  };

  return (
    <>
      {/* Floating notification banner */}
      {showBanner && bannerNotification && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <div
            className={cn(
              "flex items-center gap-3 p-4 rounded-lg shadow-lg border max-w-md",
              bannerNotification.type === "entry"
                ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
                : bannerNotification.pnl !== undefined &&
                    bannerNotification.pnl >= 0
                  ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
                  : "bg-red-500/10 border-red-500/50 text-red-400"
            )}
          >
            <div className="flex-shrink-0">
              {bannerNotification.type === "entry" ? (
                <TrendingUp className="h-6 w-6" />
              ) : bannerNotification.pnl !== undefined &&
                bannerNotification.pnl >= 0 ? (
                <TrendingUp className="h-6 w-6" />
              ) : (
                <TrendingDown className="h-6 w-6" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">
                {bannerNotification.type === "entry"
                  ? `New ${bannerNotification.direction} Entry`
                  : "Trade Closed"}
              </p>
              <p className="text-sm opacity-90 truncate">
                {bannerNotification.message}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0 h-6 w-6"
              onClick={dismissBanner}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Notification bell in header */}
      <DropdownMenu onOpenChange={open => open && markAllAsRead()}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            {isConnected ? (
              <Bell className="h-5 w-5" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground" />
            )}
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Trade Notifications</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={e => {
                  e.preventDefault();
                  setSoundEnabled(!soundEnabled);
                }}
              >
                {soundEnabled ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  isConnected ? "bg-emerald-500" : "bg-red-500"
                )}
                title={isConnected ? "Connected" : "Disconnected"}
              />
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No recent notifications
            </div>
          ) : (
            <>
              <div className="max-h-64 overflow-y-auto">
                {notifications.slice(0, 10).map((notification, index) => (
                  <DropdownMenuItem
                    key={index}
                    className="flex flex-col items-start gap-1 py-2"
                  >
                    <div className="flex items-center gap-2 w-full">
                      {notification.type === "entry" ? (
                        <TrendingUp className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      ) : notification.pnl !== undefined &&
                        notification.pnl >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}
                      <span className="font-medium text-sm truncate flex-1">
                        {notification.strategySymbol}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatNYTime(notification.timestamp)} ET
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground pl-6">
                      {notification.message}
                    </span>
                  </DropdownMenuItem>
                ))}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-center justify-center text-sm text-muted-foreground"
                onClick={clearNotifications}
              >
                Clear all notifications
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
