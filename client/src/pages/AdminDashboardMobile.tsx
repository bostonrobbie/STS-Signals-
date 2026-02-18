import React, { useState } from "react";
// @ts-expect-error TS6133 unused import
import { trpc } from "../lib/trpc";
import {
  Menu,
  X,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";

export default function AdminDashboardMobile() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "strategies" | "audit" | "flags"
  >("overview");
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // TODO: Implement admin router endpoints
  // const { data: stats } = trpc.admin.getStats.useQuery();
  // const { data: strategies } = trpc.admin.strategies.list.useQuery();
  // const { data: auditLogs } = trpc.admin.audit.search.useQuery({ limit: 10 });
  // const { data: flags } = trpc.admin.flags.list.useQuery();

  // Placeholder data until admin router is implemented
  const stats = { totalUsers: 0, totalStrategies: 0, totalTrades: 0 };
  const strategies: any[] = [];
  const auditLogs: any[] = [];
  const flags: any[] = [];

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile Header */}
      <div className="bg-white border-b border-border sticky top-0 z-40">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-lg font-bold text-foreground">Admin Dashboard</h1>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-muted/50"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {sidebarOpen && (
          <div className="border-t border-border bg-muted/30">
            <nav className="flex flex-col gap-1 p-2">
              {[
                { id: "overview", label: "Overview" },
                { id: "strategies", label: "Strategies" },
                { id: "audit", label: "Audit Logs" },
                { id: "flags", label: "Feature Flags" },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    setSidebarOpen(false);
                  }}
                  className={`px-4 py-2 rounded-lg text-left font-medium transition-colors ${
                    activeTab === item.id
                      ? "bg-blue-600 text-white"
                      : "text-foreground/80 hover:bg-muted"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        )}
      </div>

      {/* Mobile Content */}
      <div className="p-4 pb-20">
        {/* Overview Tab */}
        {activeTab === "overview" && stats && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground mb-4">
              System Overview
            </h2>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                label="Active Users"
                value={(stats as any).activeUsers}
                icon="👥"
              />
              <MetricCard
                label="Total Strategies"
                value={stats.totalStrategies}
                icon="📊"
              />
              <MetricCard
                label="Total Trades"
                value={stats.totalTrades.toLocaleString()}
                icon="💹"
              />
              <MetricCard
                label="API Requests"
                value={`${((stats as any).apiRequests / 1000).toFixed(1)}K`}
                icon="🔄"
              />
            </div>

            {/* System Health */}
            <div className="bg-white rounded-lg border border-border p-4">
              <h3 className="font-semibold text-foreground mb-3">
                System Health
              </h3>
              <div className="space-y-2">
                <HealthIndicator
                  label="Database"
                  status={(stats as any).databaseHealth}
                />
                <HealthIndicator
                  label="Cache"
                  status={(stats as any).cacheHealth}
                />
                <HealthIndicator
                  label="API"
                  status={(stats as any).apiHealth}
                />
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg border border-border p-4">
              <h3 className="font-semibold text-foreground mb-3">
                Recent Activity
              </h3>
              <div className="space-y-2 text-sm">
                {(stats as any).recentEvents
                  .slice(0, 5)
                  .map((event: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 pb-2 border-b border-gray-100 last:border-0"
                    >
                      <span className="text-muted-foreground flex-shrink-0">
                        {event.timestamp}
                      </span>
                      <span className="text-foreground/80">
                        {event.description}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Strategies Tab */}
        {activeTab === "strategies" && strategies && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground mb-4">
              Strategies
            </h2>

            {strategies.map((strategy: any) => (
              <div
                key={strategy.id}
                className="bg-white rounded-lg border border-border overflow-hidden"
              >
                <button
                  onClick={() => toggleSection(`strategy-${strategy.id}`)}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                >
                  <div className="text-left">
                    <h3 className="font-semibold text-foreground">
                      {strategy.name}
                    </h3>
                    <p className="text-sm text-foreground/70">
                      {strategy.trades} trades
                    </p>
                  </div>
                  <ChevronDown
                    size={20}
                    className={`text-muted-foreground transition-transform ${
                      expandedSection === `strategy-${strategy.id}`
                        ? "rotate-180"
                        : ""
                    }`}
                  />
                </button>

                {expandedSection === `strategy-${strategy.id}` && (
                  <div className="border-t border-border p-4 bg-muted/30 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-foreground/70">Win Rate</span>
                      <span className="font-medium text-foreground">
                        {strategy.winRate}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground/70">Sharpe Ratio</span>
                      <span className="font-medium text-foreground">
                        {strategy.sharpeRatio.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground/70">Status</span>
                      <span
                        className={`font-medium ${strategy.active ? "text-green-600" : "text-foreground/70"}`}
                      >
                        {strategy.active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="flex gap-2 pt-3">
                      <button className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                        {strategy.active ? "Pause" : "Resume"}
                      </button>
                      <button className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Audit Logs Tab */}
        {activeTab === "audit" && auditLogs && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground mb-4">
              Audit Logs
            </h2>
            {(auditLogs as any).logs.map((log: any, idx: number) => (
              <div
                key={idx}
                className="bg-white rounded-lg border border-border p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {log.action === "create" && (
                      <CheckCircle size={20} className="text-green-600" />
                    )}
                    {log.action === "update" && (
                      <Clock size={20} className="text-blue-600" />
                    )}
                    {log.action === "delete" && (
                      <AlertCircle size={20} className="text-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {log.action}
                    </p>
                    <p className="text-sm text-foreground/70">{log.entity}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {log.user}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {log.timestamp}
                    </p>
                  </div>
                </div>
                {log.details && (
                  <div className="mt-3 p-2 bg-muted/30 rounded text-xs text-foreground/70 font-mono overflow-x-auto">
                    {JSON.stringify(log.details, null, 2)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Feature Flags Tab */}
        {activeTab === "flags" && flags && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground mb-4">
              Feature Flags
            </h2>

            {flags.map((flag: any) => (
              <div
                key={flag.id}
                className="bg-white rounded-lg border border-border p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {flag.name}
                    </h3>
                    <p className="text-sm text-foreground/70">
                      {flag.description}
                    </p>
                  </div>
                  <button
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                      flag.enabled ? "bg-green-600" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                        flag.enabled ? "translate-x-7" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                {flag.rolloutPercentage !== undefined && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-foreground/70">Rollout</span>
                      <span className="font-medium text-foreground">
                        {flag.rolloutPercentage}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${flag.rolloutPercentage}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper Components

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-border p-3">
      <div className="text-2xl mb-1">{icon}</div>
      <p className="text-xs text-foreground/70">{label}</p>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function HealthIndicator({
  label,
  status,
}: {
  label: string;
  status: "healthy" | "degraded" | "down";
}) {
  const statusColors = {
    healthy: "bg-green-100 text-green-800",
    degraded: "bg-yellow-100 text-yellow-800",
    down: "bg-red-100 text-red-800",
  };

  const statusIcons = {
    healthy: "✓",
    degraded: "⚠",
    down: "✕",
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-foreground/80">{label}</span>
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${statusColors[status]}`}
      >
        {statusIcons[status]} {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    </div>
  );
}
