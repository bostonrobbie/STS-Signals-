// @ts-expect-error TS6133 unused
import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
// @ts-expect-error TS6133 unused
import { trpc } from "../lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Alert, AlertDescription } from "../components/ui/alert";
import { AlertCircle, CheckCircle, Loader } from "lucide-react";

/**
 * Admin Dashboard Component
 * Provides administrative controls for system management
 */

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedStrategy, setSelectedStrategy] = useState<number | null>(null);
  // @ts-expect-error TS6133 unused
  const [selectedUser, _setSelectedUser] = useState<string | null>(null);

  // Queries
  const statsQuery = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      // Will call admin.getStats endpoint
      return { totalUsers: 0, totalStrategies: 0, totalTrades: 0 };
    },
  });

  const healthQuery = useQuery({
    queryKey: ["admin", "health"],
    queryFn: async () => {
      // Will call admin.getHealth endpoint
      return { status: "healthy", uptime: 0 };
    },
  });

  const auditLogsQuery = useQuery({
    queryKey: ["admin", "audit", "logs"],
    queryFn: async () => {
      // Will call admin.audit.search endpoint
      return [];
    },
  });

  const featureFlagsQuery = useQuery({
    queryKey: ["admin", "flags"],
    queryFn: async () => {
      // Will call admin.flags.getAll endpoint
      return [];
    },
  });

  // Mutations
  const pauseStrategyMutation = useMutation({
    mutationFn: async (_strategyId: number) => {
      // Will call admin.pauseStrategy endpoint
      return { success: true };
    },
  });

  const resumeStrategyMutation = useMutation({
    mutationFn: async (_strategyId: number) => {
      // Will call admin.resumeStrategy endpoint
      return { success: true };
    },
  });

  // @ts-expect-error TS6133 unused
  const _deleteTradesMutation = useMutation({
    mutationFn: async (tradeIds: number[]) => {
      // Will call admin.deleteMultipleTrades endpoint
      return { success: true, deleted: tradeIds.length };
    },
  });

  const enableFeatureFlagMutation = useMutation({
    mutationFn: async (_flagName: string) => {
      // Will call admin.flags.enable endpoint
      return { success: true };
    },
  });

  const disableFeatureFlagMutation = useMutation({
    mutationFn: async (_flagName: string) => {
      // Will call admin.flags.disable endpoint
      return { success: true };
    },
  });

  return (
    <div className="w-full h-full bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-600 mt-2">
            System management and monitoring
          </p>
        </div>

        {/* System Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {healthQuery.isLoading ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : healthQuery.data?.status === "healthy" ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-600">Healthy</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="font-semibold text-red-600">
                    Issues Detected
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {statsQuery.data?.totalUsers || 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">
                Total Strategies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {statsQuery.data?.totalStrategies || 0}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="strategies">Strategies</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>System Overview</CardTitle>
                <CardDescription>
                  Current system metrics and status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600">Uptime</p>
                    <p className="text-lg font-semibold">
                      {healthQuery.data?.uptime || 0}s
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Total Trades</p>
                    <p className="text-lg font-semibold">
                      {statsQuery.data?.totalTrades || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Strategies Tab */}
          <TabsContent value="strategies" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Strategy Management</CardTitle>
                <CardDescription>
                  Pause, resume, or manage strategies
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Strategy ID</label>
                  <input
                    type="number"
                    placeholder="Enter strategy ID"
                    value={selectedStrategy || ""}
                    onChange={e =>
                      setSelectedStrategy(
                        e.target.value ? parseInt(e.target.value) : null
                      )
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      selectedStrategy &&
                      pauseStrategyMutation.mutate(selectedStrategy)
                    }
                    disabled={
                      !selectedStrategy || pauseStrategyMutation.isPending
                    }
                    variant="outline"
                  >
                    {pauseStrategyMutation.isPending
                      ? "Pausing..."
                      : "Pause Strategy"}
                  </Button>
                  <Button
                    onClick={() =>
                      selectedStrategy &&
                      resumeStrategyMutation.mutate(selectedStrategy)
                    }
                    disabled={
                      !selectedStrategy || resumeStrategyMutation.isPending
                    }
                    variant="outline"
                  >
                    {resumeStrategyMutation.isPending
                      ? "Resuming..."
                      : "Resume Strategy"}
                  </Button>
                </div>

                {pauseStrategyMutation.isSuccess && (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Strategy updated successfully
                    </AlertDescription>
                  </Alert>
                )}

                {pauseStrategyMutation.isError && (
                  <Alert className="bg-red-50 border-red-200">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      Failed to update strategy
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Audit Log</CardTitle>
                <CardDescription>
                  System activity and user actions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {auditLogsQuery.isLoading ? (
                  <div className="flex justify-center">
                    <Loader className="w-5 h-5 animate-spin" />
                  </div>
                ) : auditLogsQuery.data && auditLogsQuery.data.length > 0 ? (
                  <div className="space-y-2">
                    {auditLogsQuery.data.map((log: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 rounded-md text-sm"
                      >
                        <p className="font-medium">{log.action}</p>
                        <p className="text-slate-600">
                          {log.timestamp
                            ? new Date(log.timestamp).toLocaleString()
                            : "-"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-600">No audit logs found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Features Tab */}
          <TabsContent value="features" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Feature Flags</CardTitle>
                <CardDescription>
                  Manage feature flags and rollouts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {featureFlagsQuery.isLoading ? (
                  <div className="flex justify-center">
                    <Loader className="w-5 h-5 animate-spin" />
                  </div>
                ) : featureFlagsQuery.data &&
                  featureFlagsQuery.data.length > 0 ? (
                  <div className="space-y-3">
                    {featureFlagsQuery.data.map((flag: any) => (
                      <div
                        key={flag.name}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-md"
                      >
                        <div>
                          <p className="font-medium">{flag.name}</p>
                          <p className="text-sm text-slate-600">
                            Rollout: {flag.rolloutPercentage}%
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() =>
                              enableFeatureFlagMutation.mutate(flag.name)
                            }
                            disabled={
                              flag.enabled ||
                              enableFeatureFlagMutation.isPending
                            }
                            size="sm"
                            variant="outline"
                          >
                            Enable
                          </Button>
                          <Button
                            onClick={() =>
                              disableFeatureFlagMutation.mutate(flag.name)
                            }
                            disabled={
                              !flag.enabled ||
                              disableFeatureFlagMutation.isPending
                            }
                            size="sm"
                            variant="outline"
                          >
                            Disable
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-600">No feature flags found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
