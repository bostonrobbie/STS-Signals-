/**
 * Position Manager Component
 *
 * Admin UI for managing positions and resolving discrepancies:
 * - View all open positions
 * - Force close positions
 * - Run reconciliation against broker
 * - View and resolve discrepancies
 * - View adjustment history
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  History,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

export function PositionManager() {
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [forceCloseReason, setForceCloseReason] = useState("");
  const [isForceCloseOpen, setIsForceCloseOpen] = useState(false);

  // Queries
  const {
    data: positions,
    isLoading: positionsLoading,
    refetch: refetchPositions,
  } = trpc.webhook.getOpenPositions.useQuery();
  const {
    data: discrepancies,
    isLoading: discrepanciesLoading,
    refetch: refetchDiscrepancies,
  } = trpc.webhook.getDiscrepancies.useQuery();
  const { data: adjustmentHistory, isLoading: historyLoading } =
    trpc.webhook.getAdjustmentHistory.useQuery();

  // Mutations
  const forceCloseMutation = trpc.webhook.forceClosePosition.useMutation({
    onSuccess: () => {
      toast.success("Position force closed successfully");
      setIsForceCloseOpen(false);
      setForceCloseReason("");
      refetchPositions();
    },
    onError: (error: { message: string }) => {
      toast.error(`Failed to force close: ${error.message}`);
    },
  });

  const resolveDiscrepancyMutation =
    trpc.webhook.resolveDiscrepancy.useMutation({
      onSuccess: () => {
        toast.success("Discrepancy resolved");
        refetchDiscrepancies();
      },
      onError: (error: { message: string }) => {
        toast.error(`Failed to resolve: ${error.message}`);
      },
    });

  const handleForceClose = () => {
    if (!selectedPosition || !forceCloseReason.trim()) {
      toast.error("Please provide a reason for force closing");
      return;
    }
    forceCloseMutation.mutate({
      positionId: selectedPosition,
      reason: forceCloseReason,
    });
  };

  const handleResolve = (discrepancyId: number, action: string) => {
    resolveDiscrepancyMutation.mutate({
      discrepancyId,
      action: action as
        | "sync_from_broker"
        | "force_close"
        | "ignore"
        | "manual_fix",
    });
  };

  const formatPrice = (cents: number) => {
    return (cents / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return (
      d.toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }) + " ET"
    );
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="positions" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="positions">
            Open Positions
            {positions && positions.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {positions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="discrepancies">
            Discrepancies
            {discrepancies && discrepancies.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {discrepancies.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Adjustment History</TabsTrigger>
        </TabsList>

        {/* Open Positions Tab */}
        <TabsContent value="positions" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Open Positions</CardTitle>
                <CardDescription>
                  Manage positions tracked in the database
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchPositions()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {positionsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading positions...
                </div>
              ) : !positions || positions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No open positions
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Strategy</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Entry Price</TableHead>
                      <TableHead>Entry Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {positions.map(
                      (pos: {
                        id: number;
                        strategySymbol: string;
                        direction: string;
                        quantity: number;
                        entryPrice: number;
                        entryTime: string | Date;
                        status: string;
                      }) => (
                        <TableRow key={pos.id}>
                          <TableCell className="font-medium">
                            {pos.strategySymbol}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                pos.direction === "long"
                                  ? "default"
                                  : "destructive"
                              }
                            >
                              {pos.direction.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>{pos.quantity}</TableCell>
                          <TableCell>{formatPrice(pos.entryPrice)}</TableCell>
                          <TableCell>{formatDate(pos.entryTime)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{pos.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <Dialog
                              open={
                                isForceCloseOpen && selectedPosition === pos.id
                              }
                              onOpenChange={open => {
                                setIsForceCloseOpen(open);
                                if (open) setSelectedPosition(pos.id);
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Force Close
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>
                                    Force Close Position
                                  </DialogTitle>
                                  <DialogDescription>
                                    This will mark the position as closed
                                    without an exit signal. Use this to fix
                                    database state when the position was closed
                                    manually in the broker.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label>Position Details</Label>
                                    <div className="text-sm text-muted-foreground">
                                      {pos.strategySymbol} -{" "}
                                      {pos.direction.toUpperCase()}{" "}
                                      {pos.quantity} @{" "}
                                      {formatPrice(pos.entryPrice)}
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="reason">
                                      Reason for Force Close
                                    </Label>
                                    <Textarea
                                      id="reason"
                                      placeholder="e.g., Position was closed manually in broker"
                                      value={forceCloseReason}
                                      onChange={e =>
                                        setForceCloseReason(e.target.value)
                                      }
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button
                                    variant="outline"
                                    onClick={() => setIsForceCloseOpen(false)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    onClick={handleForceClose}
                                    disabled={forceCloseMutation.isPending}
                                  >
                                    {forceCloseMutation.isPending
                                      ? "Closing..."
                                      : "Force Close"}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Discrepancies Tab */}
        <TabsContent value="discrepancies" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Position Discrepancies
                </CardTitle>
                <CardDescription>
                  Differences between database and broker positions
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchDiscrepancies()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {discrepanciesLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading discrepancies...
                </div>
              ) : !discrepancies || discrepancies.length === 0 ? (
                <div className="text-center py-8 text-green-600 flex items-center justify-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  No discrepancies found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>DB State</TableHead>
                      <TableHead>Broker State</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discrepancies.map(
                      (disc: {
                        id: number;
                        symbol: string;
                        discrepancyType: string;
                        dbDirection?: string;
                        dbQuantity?: number;
                        brokerDirection?: string;
                        brokerQuantity?: number;
                        discrepancyDetails?: string;
                      }) => (
                        <TableRow key={disc.id}>
                          <TableCell className="font-medium">
                            {disc.symbol}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                disc.discrepancyType === "missing_in_db"
                                  ? "destructive"
                                  : disc.discrepancyType === "missing_in_broker"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {disc.discrepancyType.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {disc.dbDirection ? (
                              <span>
                                {disc.dbDirection} {disc.dbQuantity}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {disc.brokerDirection ? (
                              <span>
                                {disc.brokerDirection} {disc.brokerQuantity}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {disc.discrepancyDetails}
                          </TableCell>
                          <TableCell>
                            <Select
                              onValueChange={value =>
                                handleResolve(disc.id, value)
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="Resolve" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="sync_from_broker">
                                  Sync from Broker
                                </SelectItem>
                                <SelectItem value="force_close">
                                  Force Close
                                </SelectItem>
                                <SelectItem value="ignore">Ignore</SelectItem>
                                <SelectItem value="manual_fix">
                                  Mark Fixed
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Adjustment History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Position Adjustment History
              </CardTitle>
              <CardDescription>
                Audit log of all position modifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading history...
                </div>
              ) : !adjustmentHistory || adjustmentHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No adjustments recorded
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Strategy</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Before</TableHead>
                      <TableHead>After</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adjustmentHistory.map(
                      (adj: {
                        id: number;
                        createdAt: string | Date;
                        strategySymbol: string;
                        adjustmentType: string;
                        beforeDirection?: string;
                        beforeQuantity?: number;
                        afterDirection?: string;
                        afterQuantity?: number;
                        reason: string;
                        adjustedBy: string;
                      }) => (
                        <TableRow key={adj.id}>
                          <TableCell>{formatDate(adj.createdAt)}</TableCell>
                          <TableCell className="font-medium">
                            {adj.strategySymbol}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {adj.adjustmentType.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {adj.beforeDirection ? (
                              <span>
                                {adj.beforeDirection} {adj.beforeQuantity}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {adj.afterDirection ? (
                              <span>
                                {adj.afterDirection} {adj.afterQuantity}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">
                                closed
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {adj.reason}
                          </TableCell>
                          <TableCell>{adj.adjustedBy}</TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
