import { useAuth } from "@/_core/hooks/useAuth";
import { useTradeNotifications } from "@/contexts/TradeNotificationContext";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
  Bell,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  toNYTime,
  formatAlertTime,
  getTimezoneAbbreviation,
} from "@/lib/timezone";

const ET_TIMEZONE = "America/New_York";

/** Format time in Eastern Time for trade display */
function formatTradeTimeET(dateInput: string | Date): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const timeStr = toNYTime(d, "time");
  const abbr = getTimezoneAbbreviation(ET_TIMEZONE, d);
  return `${timeStr} ${abbr}`;
}

/** Format alert time in Eastern Time */
function formatAlertTimeET(dateInput: string | Date | number): string {
  return formatAlertTime(dateInput, ET_TIMEZONE);
}

interface TradeAlertsSectionProps {
  className?: string;
}

export function TradeAlertsSection({ className }: TradeAlertsSectionProps) {
  const { user } = useAuth();
  const { notifications, isConnected } = useTradeNotifications();

  // Fetch open positions
  const { data: openPositions, isLoading: positionsLoading } =
    trpc.webhook.getOpenPositions.useQuery(undefined, {
      refetchInterval: 30000, // Refresh every 30 seconds
    });

  // Check if user is a paying subscriber
  const isPaidMember =
    user?.subscriptionTier === "pro" ||
    user?.subscriptionTier === "premium" ||
    // @ts-expect-error TS2339
    user?.subscriptionStatus === "active" ||
    user?.role === "admin";

  // If not a paid member, show locked state with compelling CTA
  if (!isPaidMember) {
    return (
      <Card
        className={cn(
          "border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent",
          className
        )}
      >
        <CardHeader className="text-center pb-3">
          <div className="mx-auto mb-3 p-4 rounded-full bg-emerald-500/10 ring-2 ring-emerald-500/20">
            <Bell className="h-8 w-8 text-emerald-400" />
          </div>
          <CardTitle className="text-xl font-bold">
            Get Live Trade Alerts
          </CardTitle>
          <CardDescription className="text-base mt-2">
            Receive real-time notifications when our strategies enter and exit
            trades across ES, NQ, and other futures markets
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center pb-6 space-y-4">
          <div className="flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Instant TradingView signals</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Position tracking</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>P&L notifications</span>
            </div>
          </div>
          <Button
            variant="default"
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700"
            asChild
          >
            <a href="/#pricing">Subscribe to See Live Alerts</a>
          </Button>
          <p className="text-xs text-muted-foreground">Starting at $50/month</p>
        </CardContent>
      </Card>
    );
  }

  // Use all positions (test positions are filtered server-side)
  const realPositions = openPositions || [];
  const recentNotifications = notifications.slice(0, 5);

  return (
    <div className={cn("grid gap-4 md:grid-cols-2", className)}>
      {/* Current Open Positions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Current Positions
              </CardTitle>
              <CardDescription className="text-xs">
                Active trades being tracked
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                isConnected
                  ? "text-green-500 border-green-500/30"
                  : "text-red-500 border-red-500/30"
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full mr-1.5",
                  isConnected ? "bg-green-500" : "bg-red-500"
                )}
              />
              {isConnected ? "Live" : "Offline"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {positionsLoading ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Loading positions...
            </div>
          ) : realPositions.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No open positions</p>
              <p className="text-xs text-muted-foreground mt-1">
                Waiting for next trade signal
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {realPositions.map(position => (
                <div
                  key={position.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    position.direction === "Long"
                      ? "bg-green-500/5 border-green-500/20"
                      : "bg-red-500/5 border-red-500/20"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "p-2 rounded-full",
                        position.direction === "Long"
                          ? "bg-green-500/20"
                          : "bg-red-500/20"
                      )}
                    >
                      {position.direction === "Long" ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {position.strategySymbol}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {position.direction} @ ${position.entryPrice.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {position.quantity} contract
                      {position.quantity !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTradeTimeET(position.entryTime)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Trade Alerts */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Recent Alerts
              </CardTitle>
              <CardDescription className="text-xs">
                Latest trade notifications
              </CardDescription>
            </div>
            {notifications.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {notifications.length} total
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {recentNotifications.length === 0 ? (
            <div className="text-center py-6">
              <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No recent alerts</p>
              <p className="text-xs text-muted-foreground mt-1">
                Alerts will appear here when trades are executed
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentNotifications.map((notification, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg",
                    notification.type === "entry"
                      ? "bg-blue-500/5"
                      : notification.pnl !== undefined && notification.pnl >= 0
                        ? "bg-green-500/5"
                        : "bg-red-500/5"
                  )}
                >
                  <div
                    className={cn(
                      "p-1.5 rounded-full flex-shrink-0",
                      notification.type === "entry"
                        ? "bg-blue-500/20"
                        : notification.pnl !== undefined &&
                            notification.pnl >= 0
                          ? "bg-green-500/20"
                          : "bg-red-500/20"
                    )}
                  >
                    {notification.type === "entry" ? (
                      <TrendingUp className="h-3 w-3 text-blue-500" />
                    ) : notification.pnl !== undefined &&
                      notification.pnl >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {notification.strategySymbol}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {notification.message}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground flex-shrink-0">
                    {formatAlertTimeET(notification.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
