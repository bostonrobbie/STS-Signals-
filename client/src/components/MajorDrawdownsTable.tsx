import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface MajorDrawdown {
  startDate: string;
  troughDate: string;
  recoveryDate: string | null;
  depthPct: number;
  daysToTrough: number;
  daysToRecovery: number | null;
  totalDurationDays: number;
  isOngoing: boolean;
}

interface MajorDrawdownsTableProps {
  drawdowns: MajorDrawdown[];
}

export function MajorDrawdownsTable({ drawdowns }: MajorDrawdownsTableProps) {
  if (!drawdowns || drawdowns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Major Drawdowns</CardTitle>
          <CardDescription>Drawdown periods exceeding -10%</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No major drawdowns detected in the selected time range
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getSeverityColor = (depth: number) => {
    if (depth <= -30) return 'bg-red-600';
    if (depth <= -20) return 'bg-orange-600';
    if (depth <= -15) return 'bg-yellow-600';
    return 'bg-blue-600';
  };

  const getSeverityLabel = (depth: number) => {
    if (depth <= -30) return 'Severe';
    if (depth <= -20) return 'Major';
    if (depth <= -15) return 'Moderate';
    return 'Minor';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Major Drawdowns</CardTitle>
        <CardDescription>
          {drawdowns.length} drawdown period{drawdowns.length !== 1 ? 's' : ''} exceeding -10% depth
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severity</TableHead>
                <TableHead>Depth</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Trough Date</TableHead>
                <TableHead>Recovery Date</TableHead>
                <TableHead className="text-right">Days to Trough</TableHead>
                <TableHead className="text-right">Days to Recovery</TableHead>
                <TableHead className="text-right">Total Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drawdowns.map((dd, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Badge className={getSeverityColor(dd.depthPct)}>
                      {getSeverityLabel(dd.depthPct)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-destructive">
                    {dd.depthPct.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(dd.startDate)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(dd.troughDate)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {dd.isOngoing ? (
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                        Ongoing
                      </Badge>
                    ) : dd.recoveryDate ? (
                      formatDate(dd.recoveryDate)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {dd.daysToTrough}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {dd.daysToRecovery !== null ? (
                      dd.daysToRecovery
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {dd.totalDurationDays}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 text-xs text-muted-foreground">
          <p>
            <strong>Note:</strong> "Ongoing" indicates the drawdown has not yet recovered to the previous peak.
            Days to recovery and total duration reflect the current state.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
