import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatNYTime } from "@/lib/timezone";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Bell,
  DollarSign,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

interface WebhookAlert {
  id: string;
  type: "stripe" | "tradingview" | "system";
  severity: "info" | "warning" | "error" | "critical";
  title: string;
  message: string;
  timestamp: Date;
  status: "new" | "acknowledged" | "resolved";
  data?: Record<string, any>;
}

export function WebhookAlertMonitor() {
  const [alerts, setAlerts] = useState<WebhookAlert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<WebhookAlert[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch webhook logs
  const { data: logs, refetch } = trpc.webhook.getLogs.useQuery({ limit: 50 });

  // Convert logs to alerts
  useEffect(() => {
    if (logs) {
      const newAlerts: WebhookAlert[] = logs.map((log: any) => {
        let type: "stripe" | "tradingview" | "system" = "system";
        let severity: "info" | "warning" | "error" | "critical" = "info";
        let title = "Webhook Event";

        // Determine type and severity based on log content
        if (
          log.eventType?.includes("payment") ||
          log.eventType?.includes("stripe")
        ) {
          type = "stripe";
          title = "Stripe Payment";
          if (log.status === "failed") {
            severity = "error";
          } else if (log.status === "succeeded") {
            severity = "info";
          }
        } else if (
          log.eventType?.includes("tradingview") ||
          log.eventType?.includes("signal")
        ) {
          type = "tradingview";
          title = "TradingView Signal";
          if (log.eventType?.includes("buy")) {
            severity = "info";
          } else if (log.eventType?.includes("sell")) {
            severity = "warning";
          }
        }

        return {
          id: log.id,
          type,
          severity,
          title,
          message: log.eventType || "Unknown event",
          timestamp: new Date(log.timestamp),
          status: log.status === "processed" ? "resolved" : "new",
          data: log,
        };
      });

      setAlerts(newAlerts);
    }
  }, [logs]);

  // Filter alerts
  useEffect(() => {
    let filtered = alerts;

    if (searchTerm) {
      filtered = filtered.filter(
        alert =>
          alert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          alert.message.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter(alert => alert.type === typeFilter);
    }

    if (severityFilter !== "all") {
      filtered = filtered.filter(alert => alert.severity === severityFilter);
    }

    setFilteredAlerts(filtered);
  }, [alerts, searchTerm, typeFilter, severityFilter]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refetch();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, refetch]);

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case "critical":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "error":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "warning":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      default:
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    }
  };

  // @ts-expect-error TS2503
  const getSeverityIcon = (severity: string): JSX.Element => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="h-4 w-4" />;
      case "error":
        return <XCircle className="h-4 w-4" />;
      case "warning":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  // @ts-expect-error TS2503
  const getTypeIcon = (type: string): JSX.Element => {
    switch (type) {
      case "stripe":
        return <DollarSign className="h-4 w-4" />;
      case "tradingview":
        return <Zap className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const formatTime = (date: Date) => {
    return formatNYTime(date) + " ET";
  };

  const newAlertsCount = filteredAlerts.filter(a => a.status === "new").length;
  const criticalAlertsCount = filteredAlerts.filter(
    a => a.severity === "critical" || a.severity === "error"
  ).length;

  return (
    <div className="space-y-6">
      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-400">
              {alerts.length}
            </div>
            <div className="text-xs text-muted-foreground">Total Alerts</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-400">
              {newAlertsCount}
            </div>
            <div className="text-xs text-muted-foreground">New Alerts</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-400">
              {criticalAlertsCount}
            </div>
            <div className="text-xs text-muted-foreground">Critical</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  autoRefresh ? "bg-green-400 animate-pulse" : "bg-gray-400"
                }`}
              />
              <span className="text-xs text-muted-foreground">
                {autoRefresh ? "Live" : "Paused"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Auto-refresh
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Alert Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search alerts..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="stripe">Stripe Payments</SelectItem>
                <SelectItem value="tradingview">TradingView Signals</SelectItem>
                <SelectItem value="system">System Events</SelectItem>
              </SelectContent>
            </Select>

            {/* Severity Filter */}
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>

            {/* Auto-refresh Toggle */}
            <Button
              variant={autoRefresh ? "default" : "outline"}
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {autoRefresh ? "Live" : "Paused"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Alerts Table */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Real-Time Alerts
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              {filteredAlerts.length} alerts
            </span>
          </CardTitle>
          <CardDescription>
            Monitor all webhook events and alerts in real-time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="w-12">Type</TableHead>
                  <TableHead>Alert</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlerts.length === 0 ? (
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="text-muted-foreground">
                        No alerts found
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAlerts.map(alert => (
                    <TableRow
                      key={alert.id}
                      className="border-border/50 hover:bg-accent/50"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(alert.type)}
                          <span className="text-xs capitalize">
                            {alert.type}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{alert.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {alert.message}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getSeverityColor(alert.severity)}>
                          {getSeverityIcon(alert.severity)}
                          <span className="ml-1 capitalize">
                            {alert.severity}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTime(alert.timestamp)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            alert.status === "new" ? "default" : "secondary"
                          }
                        >
                          {alert.status === "new" ? (
                            <>
                              <div className="h-2 w-2 rounded-full bg-current mr-1 animate-pulse" />
                              New
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {alert.status}
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            toast.info(JSON.stringify(alert.data, null, 2));
                          }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Stripe Payments */}
      {filteredAlerts.filter(a => a.type === "stripe").length > 0 && (
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-400" />
              Recent Stripe Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredAlerts
                .filter(a => a.type === "stripe")
                .slice(0, 5)
                .map(alert => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-accent/20"
                  >
                    <div className="flex items-center gap-3">
                      <DollarSign className="h-5 w-5 text-green-400" />
                      <div>
                        <p className="font-medium text-sm">{alert.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(alert.timestamp)}
                        </p>
                      </div>
                    </div>
                    <Badge
                      className={getSeverityColor(alert.severity)}
                      variant="outline"
                    >
                      {alert.severity}
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent TradingView Signals */}
      {filteredAlerts.filter(a => a.type === "tradingview").length > 0 && (
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              Recent TradingView Signals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredAlerts
                .filter(a => a.type === "tradingview")
                .slice(0, 5)
                .map(alert => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-accent/20"
                  >
                    <div className="flex items-center gap-3">
                      <Zap className="h-5 w-5 text-yellow-400" />
                      <div>
                        <p className="font-medium text-sm">{alert.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(alert.timestamp)}
                        </p>
                      </div>
                    </div>
                    <Badge
                      className={getSeverityColor(alert.severity)}
                      variant="outline"
                    >
                      {alert.severity}
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
