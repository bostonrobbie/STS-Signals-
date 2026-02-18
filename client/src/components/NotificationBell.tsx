import { useState } from "react";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

// Notification type icons and colors
const notificationConfig: Record<string, { color: string; bgColor: string }> = {
  trade_executed: { color: "text-emerald-400", bgColor: "bg-emerald-500/20" },
  trade_error: { color: "text-red-400", bgColor: "bg-red-500/20" },
  position_opened: { color: "text-cyan-400", bgColor: "bg-cyan-500/20" },
  position_closed: { color: "text-amber-400", bgColor: "bg-amber-500/20" },
  webhook_failed: { color: "text-red-400", bgColor: "bg-red-500/20" },
  daily_digest: { color: "text-blue-400", bgColor: "bg-blue-500/20" },
  system: { color: "text-muted-foreground", bgColor: "bg-muted/300/20" },
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(date).toLocaleDateString();
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const utils = trpc.useUtils();

  // Fetch notifications
  const { data, isLoading } = trpc.inAppNotifications.list.useQuery(
    { unreadOnly: false, limit: 20 },
    {
      refetchInterval: 30000, // Refetch every 30 seconds
      enabled: true,
    }
  );

  // Fetch unread count separately for badge (more frequent updates)
  const { data: unreadData } = trpc.inAppNotifications.unreadCount.useQuery(
    undefined,
    { refetchInterval: 10000 } // Refetch every 10 seconds
  );

  const unreadCount = unreadData?.count ?? data?.unreadCount ?? 0;
  const notifications = data?.notifications ?? [];

  // Mutations
  const markAsReadMutation = trpc.inAppNotifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.inAppNotifications.list.invalidate();
      utils.inAppNotifications.unreadCount.invalidate();
    },
  });

  const markAllAsReadMutation =
    trpc.inAppNotifications.markAllAsRead.useMutation({
      onSuccess: () => {
        utils.inAppNotifications.list.invalidate();
        utils.inAppNotifications.unreadCount.invalidate();
      },
    });

  const deleteMutation = trpc.inAppNotifications.delete.useMutation({
    onSuccess: () => {
      utils.inAppNotifications.list.invalidate();
      utils.inAppNotifications.unreadCount.invalidate();
    },
  });

  const handleMarkAsRead = (notificationId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    markAsReadMutation.mutate({ notificationId });
  };

  const handleDelete = (notificationId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteMutation.mutate({ notificationId });
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-lg hover:bg-accent/50"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground animate-pulse">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 sm:w-96 p-0"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/20 text-primary rounded">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsReadMutation.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notification List */}
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification: any) => {
                const config =
                  notificationConfig[notification.type] ||
                  notificationConfig.system;
                const isUnread = !notification.read;

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "px-4 py-3 hover:bg-accent/30 transition-colors cursor-pointer group relative",
                      isUnread && "bg-primary/5"
                    )}
                    onClick={() => {
                      if (isUnread) {
                        markAsReadMutation.mutate({
                          notificationId: notification.id,
                        });
                      }
                    }}
                  >
                    <div className="flex gap-3">
                      {/* Unread indicator */}
                      {isUnread && (
                        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                      )}

                      {/* Icon */}
                      <div
                        className={cn(
                          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                          config.bgColor
                        )}
                      >
                        <Bell className={cn("h-4 w-4", config.color)} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm truncate",
                            isUnread ? "font-medium" : "text-muted-foreground"
                          )}
                        >
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {notification.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {formatTimeAgo(notification.createdAt)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex-shrink-0 flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isUnread && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={e => handleMarkAsRead(notification.id, e)}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={e => handleDelete(notification.id, e)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator className="m-0" />
            <div className="p-2">
              <Button
                variant="ghost"
                className="w-full h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setIsOpen(false)}
              >
                View all notifications
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
