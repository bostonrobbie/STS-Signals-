/**
 * Performance Breakdown Component
 * 
 * Displays performance metrics broken down by time periods:
 * - Daily, Weekly, Monthly, Quarterly, Yearly
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TimePeriodPerformance {
  period: string;
  periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: Date;
  endDate: Date;
  trades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  returnPercent: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
}

interface PerformanceBreakdownData {
  daily: TimePeriodPerformance[];
  weekly: TimePeriodPerformance[];
  monthly: TimePeriodPerformance[];
  quarterly: TimePeriodPerformance[];
  yearly: TimePeriodPerformance[];
}

interface PerformanceBreakdownProps {
  data: PerformanceBreakdownData;
  isLoading?: boolean;
}

export function PerformanceBreakdown({ data, isLoading }: PerformanceBreakdownProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Breakdown</CardTitle>
          <CardDescription>Loading performance data...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Breakdown</CardTitle>
        <CardDescription>
          Performance metrics broken down by time periods
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="monthly" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
            <TabsTrigger value="yearly">Yearly</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="mt-4">
            <BreakdownTable data={data.daily} periodType="daily" />
          </TabsContent>

          <TabsContent value="weekly" className="mt-4">
            <BreakdownTable data={data.weekly} periodType="weekly" />
          </TabsContent>

          <TabsContent value="monthly" className="mt-4">
            <BreakdownTable data={data.monthly} periodType="monthly" />
          </TabsContent>

          <TabsContent value="quarterly" className="mt-4">
            <BreakdownTable data={data.quarterly} periodType="quarterly" />
          </TabsContent>

          <TabsContent value="yearly" className="mt-4">
            <BreakdownTable data={data.yearly} periodType="yearly" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface BreakdownTableProps {
  data: TimePeriodPerformance[];
  periodType: string;
}

function BreakdownTable({ data, periodType }: BreakdownTableProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No {periodType} data available for the selected time range
      </div>
    );
  }

  // Sort by period descending (most recent first)
  const sortedData = [...data].sort((a, b) => 
    b.startDate.getTime() - a.startDate.getTime()
  );

  // Limit to most recent 20 periods for readability
  const displayData = sortedData.slice(0, 20);

  return (
    <div className="rounded-md border overflow-auto max-h-[500px]">
      <Table>
        <TableHeader className="sticky top-0 bg-background">
          <TableRow>
            <TableHead className="font-semibold">Period</TableHead>
            <TableHead className="text-right font-semibold">Return</TableHead>
            <TableHead className="text-right font-semibold">P&L</TableHead>
            <TableHead className="text-right font-semibold">Trades</TableHead>
            <TableHead className="text-right font-semibold">Win Rate</TableHead>
            <TableHead className="text-right font-semibold">Profit Factor</TableHead>
            <TableHead className="text-right font-semibold">Avg Win</TableHead>
            <TableHead className="text-right font-semibold">Avg Loss</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayData.map((row, idx) => (
            <TableRow key={`${row.period}-${row.periodType}-${idx}`}>
              <TableCell className="font-medium">
                {formatPeriod(row.period, row.periodType)}
              </TableCell>
              <TableCell 
                className={`text-right font-medium ${
                  row.returnPercent > 0 ? 'text-green-600' : 
                  row.returnPercent < 0 ? 'text-red-600' : ''
                }`}
              >
                {row.returnPercent.toFixed(2)}%
              </TableCell>
              <TableCell 
                className={`text-right ${
                  row.totalPnL > 0 ? 'text-green-600' : 
                  row.totalPnL < 0 ? 'text-red-600' : ''
                }`}
              >
                ${row.totalPnL.toLocaleString(undefined, { 
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0 
                })}
              </TableCell>
              <TableCell className="text-right">
                {row.trades}
                <span className="text-muted-foreground text-xs ml-1">
                  ({row.winningTrades}W/{row.losingTrades}L)
                </span>
              </TableCell>
              <TableCell className="text-right">
                {row.winRate.toFixed(1)}%
              </TableCell>
              <TableCell className="text-right">
                {row.profitFactor.toFixed(2)}
              </TableCell>
              <TableCell className="text-right text-green-600">
                ${row.avgWin.toLocaleString(undefined, { 
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0 
                })}
              </TableCell>
              <TableCell className="text-right text-red-600">
                ${row.avgLoss.toLocaleString(undefined, { 
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0 
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Format period string for display
 */
function formatPeriod(period: string, periodType: string): string {
  switch (periodType) {
    case 'daily':
      return new Date(period).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    case 'weekly':
      return period; // Already formatted as "2024-W48"
    case 'monthly':
      const [year, month] = period.split('-');
      const date = new Date(parseInt(year!), parseInt(month!) - 1, 1);
      return date.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      });
    case 'quarterly':
      return period; // Already formatted as "2024-Q4"
    case 'yearly':
      return period; // Already formatted as "2024"
    default:
      return period;
  }
}
