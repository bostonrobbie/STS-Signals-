/**
 * QA Dashboard - Pipeline Health Monitoring
 * 
 * Provides real-time monitoring of the webhook-to-trade data pipeline,
 * including health checks, data integrity validation, and processing metrics.
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { 
  Activity, 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Database, 
  FileWarning, 
  Play, 
  RefreshCw, 
  Shield, 
  TrendingUp,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';

function StatusBadge({ status }: { status: 'pass' | 'fail' | 'warn' }) {
  if (status === 'pass') {
    return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Pass</Badge>;
  } else if (status === 'fail') {
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Fail</Badge>;
  } else {
    return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Warning</Badge>;
  }
}

function HealthCheckCard() {
  const { data: health, isLoading, refetch } = trpc.qa.healthCheck.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Pipeline Health
          </CardTitle>
          <CardDescription>Real-time health status of the data pipeline</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading health status...</div>
        ) : health ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {health.healthy ? (
                <>
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                  <span className="text-lg font-semibold text-green-500">All Systems Healthy</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-6 w-6 text-red-500" />
                  <span className="text-lg font-semibold text-red-500">Issues Detected</span>
                </>
              )}
            </div>
            
            <div className="grid gap-3">
              {health.checks.map((check, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    {check.status === 'pass' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : check.status === 'fail' ? (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    )}
                    <span className="font-medium">{check.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{check.message}</span>
                    <StatusBadge status={check.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">Failed to load health status</div>
        )}
      </CardContent>
    </Card>
  );
}

function DataIntegrityCard() {
  const { data: validation, isLoading, refetch, isFetching } = trpc.qa.validateIntegrity.useQuery(undefined, {
    enabled: false, // Only run when manually triggered
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Integrity Validation
          </CardTitle>
          <CardDescription>Comprehensive validation of all data relationships</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? (
            <>
              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-1" />
              Run Validation
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading || isFetching ? (
          <div className="text-center py-8 text-muted-foreground">
            <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
            Running validation checks...
          </div>
        ) : validation ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {validation.isValid ? (
                <>
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                  <span className="text-lg font-semibold text-green-500">All Validations Passed</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-6 w-6 text-red-500" />
                  <span className="text-lg font-semibold text-red-500">
                    {validation.errors.length} Error(s) Found
                  </span>
                </>
              )}
              <span className="text-sm text-muted-foreground ml-auto">
                Completed in {validation.duration}ms
              </span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-2xl font-bold">{validation.stats.openPositions}</div>
                <div className="text-xs text-muted-foreground">Open Positions</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-2xl font-bold">{validation.stats.closedPositions}</div>
                <div className="text-xs text-muted-foreground">Closed Positions</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-2xl font-bold">{validation.stats.totalTrades}</div>
                <div className="text-xs text-muted-foreground">Total Trades</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-2xl font-bold">{validation.stats.webhookLogs}</div>
                <div className="text-xs text-muted-foreground">Webhook Logs</div>
              </div>
            </div>

            {/* Errors */}
            {validation.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-red-500 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Errors ({validation.errors.length})
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {validation.errors.map((error, idx) => (
                    <div key={idx} className="p-2 rounded bg-red-500/10 border border-red-500/20 text-sm">
                      <span className="font-mono text-red-400">[{error.code}]</span> {error.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {validation.warnings.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-yellow-500 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Warnings ({validation.warnings.length})
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {validation.warnings.map((warning, idx) => (
                    <div key={idx} className="p-2 rounded bg-yellow-500/10 border border-yellow-500/20 text-sm">
                      <span className="font-mono text-yellow-400">[{warning.code}]</span> {warning.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <FileWarning className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Click "Run Validation" to check data integrity
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WebhookMetricsCard() {
  const [hours, setHours] = useState(24);
  const { data: metrics, isLoading, refetch } = trpc.qa.webhookMetrics.useQuery(
    { hours },
    { refetchInterval: 60000 } // Refresh every minute
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Webhook Processing Metrics
          </CardTitle>
          <CardDescription>{metrics?.period || `Last ${hours} hours`}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <select 
            className="bg-muted border rounded px-2 py-1 text-sm"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          >
            <option value={1}>Last 1 hour</option>
            <option value={6}>Last 6 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={72}>Last 3 days</option>
            <option value={168}>Last 7 days</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading metrics...</div>
        ) : metrics ? (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-2xl font-bold">{metrics.summary.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 text-center">
                <div className="text-2xl font-bold text-green-500">{metrics.summary.successful}</div>
                <div className="text-xs text-muted-foreground">Successful</div>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10 text-center">
                <div className="text-2xl font-bold text-red-500">{metrics.summary.failed}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
              <div className="p-3 rounded-lg bg-yellow-500/10 text-center">
                <div className="text-2xl font-bold text-yellow-500">{metrics.summary.duplicate}</div>
                <div className="text-xs text-muted-foreground">Duplicate</div>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10 text-center">
                <div className="text-2xl font-bold text-blue-500">{metrics.summary.successRate}</div>
                <div className="text-xs text-muted-foreground">Success Rate</div>
              </div>
            </div>

            {/* Latency Stats */}
            <div className="p-4 rounded-lg bg-muted/30">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Processing Latency
              </h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xl font-bold">{metrics.latency.min}ms</div>
                  <div className="text-xs text-muted-foreground">Min</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{metrics.latency.avg}ms</div>
                  <div className="text-xs text-muted-foreground">Average</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{metrics.latency.max}ms</div>
                  <div className="text-xs text-muted-foreground">Max</div>
                </div>
              </div>
            </div>

            {/* By Strategy */}
            {metrics.byStrategy.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3">By Strategy</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Strategy</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Success</TableHead>
                      <TableHead className="text-right">Failed</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.byStrategy.map((s) => (
                      <TableRow key={s.symbol}>
                        <TableCell className="font-medium">{s.symbol}</TableCell>
                        <TableCell className="text-right">{s.total}</TableCell>
                        <TableCell className="text-right text-green-500">{s.success}</TableCell>
                        <TableCell className="text-right text-red-500">{s.failed}</TableCell>
                        <TableCell className="text-right">
                          {s.total > 0 ? ((s.success / s.total) * 100).toFixed(0) : 0}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Recent Failures */}
            {metrics.recentFailures.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3 text-red-500 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Recent Failures
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {metrics.recentFailures.map((f) => (
                    <div key={f.id} className="p-2 rounded bg-red-500/10 border border-red-500/20 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{f.strategySymbol || 'Unknown'}</span>
                        <span className="text-muted-foreground text-xs">
                          {new Date(f.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-red-400 text-xs mt-1">{f.errorMessage}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">No metrics available</div>
        )}
      </CardContent>
    </Card>
  );
}

function PipelineTestCard() {
  const runTest = trpc.qa.runPipelineTest.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success('All pipeline tests passed!');
      } else {
        toast.error(result.summary);
      }
    },
    onError: (error) => {
      toast.error(`Test failed: ${error.message}`);
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            End-to-End Pipeline Test
          </CardTitle>
          <CardDescription>Run a comprehensive test of the entire pipeline</CardDescription>
        </div>
        <Button 
          onClick={() => runTest.mutate({ strategySymbol: 'ESTrend' })}
          disabled={runTest.isPending}
        >
          {runTest.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-1" />
              Run Test
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {runTest.data ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {runTest.data.success ? (
                <>
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                  <span className="text-lg font-semibold text-green-500">{runTest.data.summary}</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-6 w-6 text-red-500" />
                  <span className="text-lg font-semibold text-red-500">{runTest.data.summary}</span>
                </>
              )}
              <span className="text-sm text-muted-foreground ml-auto">
                Total: {runTest.data.totalDurationMs}ms
              </span>
            </div>

            <div className="space-y-2">
              {runTest.data.steps.map((step, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    {step.status === 'pass' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className="font-medium">{step.step}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{step.message}</span>
                    <span className="text-xs text-muted-foreground">{step.durationMs}ms</span>
                    <StatusBadge status={step.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Click "Run Test" to verify the pipeline is working correctly
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OpenPositionsCard() {
  const { data: positions, isLoading, refetch } = trpc.qa.openPositionsStatus.useQuery(undefined, {
    refetchInterval: 30000,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Open Positions
          </CardTitle>
          <CardDescription>Currently tracked open positions</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading positions...</div>
        ) : positions && positions.count > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Strategy</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead className="text-right">Entry Price</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.positions.map((pos) => (
                <TableRow key={pos.id}>
                  <TableCell className="font-medium">{pos.strategySymbol}</TableCell>
                  <TableCell>
                    <Badge variant={pos.direction === 'Long' ? 'default' : 'destructive'}>
                      {pos.direction}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">${pos.entryPrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{pos.quantity}</TableCell>
                  <TableCell className="text-right">
                    {pos.ageMinutes < 60 
                      ? `${pos.ageMinutes}m` 
                      : `${Math.floor(pos.ageMinutes / 60)}h ${pos.ageMinutes % 60}m`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No open positions
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AllPipelinesValidationCard() {
  const { data: validation, isLoading, refetch } = trpc.qa.validateAllPipelines.useQuery(undefined, {
    refetchInterval: 60000, // Refresh every minute
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'degraded': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'degraded': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critical': return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return <Activity className="h-5 w-5" />;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            All Pipelines Validation
          </CardTitle>
          <CardDescription>Comprehensive validation of all data pipelines</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Validate
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Running validation...</div>
        ) : validation ? (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              {getStatusIcon(validation.overall)}
              <span className={`text-lg font-semibold ${getStatusColor(validation.overall)}`}>
                Overall: {validation.overall.charAt(0).toUpperCase() + validation.overall.slice(1)}
              </span>
              <span className="text-sm text-muted-foreground ml-auto">
                Completed in {validation.totalDuration}ms
              </span>
            </div>

            <div className="space-y-4">
              {validation.pipelines.map((pipeline, idx) => (
                <div key={idx} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(pipeline.status)}
                      <span className="font-semibold capitalize">{pipeline.pipeline} Pipeline</span>
                    </div>
                    <Badge 
                      className={pipeline.status === 'healthy' 
                        ? 'bg-green-500/20 text-green-400' 
                        : pipeline.status === 'degraded'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                      }
                    >
                      {pipeline.status}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {pipeline.checks.map((check, checkIdx) => (
                      <div key={checkIdx} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <div className="flex items-center gap-2">
                          {check.status === 'pass' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : check.status === 'warn' ? (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-sm">{check.name}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{check.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Click "Validate" to run comprehensive pipeline validation
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AutoRepairCard() {
  const repairPositions = trpc.qa.repairOrphanedPositions.useMutation({
    onSuccess: (data) => {
      if (data.repaired > 0) {
        toast.success(`Repaired ${data.repaired} orphaned positions`);
      } else if (data.failed > 0) {
        toast.error(`Failed to repair ${data.failed} positions`);
      } else {
        toast.info('No orphaned positions to repair');
      }
    },
    onError: (error) => {
      toast.error(`Repair failed: ${error.message}`);
    },
  });

  const repairWebhooks = trpc.qa.repairOrphanedExitWebhooks.useMutation({
    onSuccess: (data) => {
      if (data.repaired > 0) {
        toast.success(`Linked ${data.repaired} orphaned exit webhooks`);
      } else if (data.failed > 0) {
        toast.error(`Failed to link ${data.failed} webhooks`);
      } else {
        toast.info('No orphaned webhooks to repair');
      }
    },
    onError: (error) => {
      toast.error(`Repair failed: ${error.message}`);
    },
  });

  const { data: webhookStatus } = trpc.qa.webhookPipelineStatus.useQuery();
  const { data: positionStatus } = trpc.qa.positionPipelineStatus.useQuery();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Auto-Repair Tools
        </CardTitle>
        <CardDescription>Automatically fix common data integrity issues</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold mb-2">Orphaned Positions</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Create missing trade records for closed positions without trades.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm">
                {positionStatus?.orphanedPositions || 0} orphaned positions
              </span>
              <Button 
                size="sm" 
                onClick={() => repairPositions.mutate()}
                disabled={repairPositions.isPending || (positionStatus?.orphanedPositions || 0) === 0}
              >
                {repairPositions.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-1" />
                )}
                Repair
              </Button>
            </div>
            {repairPositions.data && (
              <div className="mt-2 text-sm">
                <span className="text-green-500">Repaired: {repairPositions.data.repaired}</span>
                {repairPositions.data.failed > 0 && (
                  <span className="text-red-500 ml-2">Failed: {repairPositions.data.failed}</span>
                )}
              </div>
            )}
          </div>

          <div className="border rounded-lg p-4">
            <h4 className="font-semibold mb-2">Orphaned Exit Webhooks</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Link successful exit webhooks to their corresponding trades.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm">
                {webhookStatus?.orphanedExits || 0} orphaned webhooks
              </span>
              <Button 
                size="sm" 
                onClick={() => repairWebhooks.mutate()}
                disabled={repairWebhooks.isPending || (webhookStatus?.orphanedExits || 0) === 0}
              >
                {repairWebhooks.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-1" />
                )}
                Repair
              </Button>
            </div>
            {repairWebhooks.data && (
              <div className="mt-2 text-sm">
                <span className="text-green-500">Linked: {repairWebhooks.data.repaired}</span>
                {repairWebhooks.data.failed > 0 && (
                  <span className="text-red-500 ml-2">Failed: {repairWebhooks.data.failed}</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2">Pipeline Status Summary</h4>
          <div className="grid gap-2 md:grid-cols-4">
            <div className="text-center p-3 rounded bg-muted/50">
              <div className="text-2xl font-bold">{positionStatus?.openPositions || 0}</div>
              <div className="text-xs text-muted-foreground">Open Positions</div>
            </div>
            <div className="text-center p-3 rounded bg-muted/50">
              <div className="text-2xl font-bold text-yellow-500">{positionStatus?.stalePositions || 0}</div>
              <div className="text-xs text-muted-foreground">Stale Positions</div>
            </div>
            <div className="text-center p-3 rounded bg-muted/50">
              <div className="text-2xl font-bold">{webhookStatus?.recentFailureRate?.toFixed(1) || 0}%</div>
              <div className="text-xs text-muted-foreground">Failure Rate</div>
            </div>
            <div className="text-center p-3 rounded bg-muted/50">
              <div className="text-2xl font-bold">{webhookStatus?.avgProcessingTime?.toFixed(0) || 0}ms</div>
              <div className="text-xs text-muted-foreground">Avg Processing</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function QADashboard() {
  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pipeline QA Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor and validate the webhook-to-trade data pipeline
        </p>
      </div>

      <Tabs defaultValue="health" className="space-y-4">
        <TabsList>
          <TabsTrigger value="health">Health & Integrity</TabsTrigger>
          <TabsTrigger value="validation">Pipeline Validation</TabsTrigger>
          <TabsTrigger value="metrics">Webhook Metrics</TabsTrigger>
          <TabsTrigger value="test">Pipeline Test</TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <HealthCheckCard />
            <OpenPositionsCard />
          </div>
          <DataIntegrityCard />
        </TabsContent>

        <TabsContent value="validation" className="space-y-4">
          <AllPipelinesValidationCard />
          <AutoRepairCard />
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <WebhookMetricsCard />
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <PipelineTestCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
