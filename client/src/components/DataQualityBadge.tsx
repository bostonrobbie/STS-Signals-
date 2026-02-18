import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DataQualityReport {
  totalTrades: number;
  validTrades: number;
  invalidTrades: number;
  outlierCount: number;
  hasNegativeEquity: boolean;
  lowestEquity: number;
  dataIssues: string[];
  overallQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

interface DataQualityBadgeProps {
  quality: DataQualityReport;
  compact?: boolean;
}

const qualityConfig = {
  excellent: {
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/30',
    icon: CheckCircle,
    label: 'Excellent',
    description: 'All data passes validation checks',
  },
  good: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
    icon: CheckCircle,
    label: 'Good',
    description: 'Minor issues detected but data is reliable',
  },
  fair: {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/30',
    icon: AlertTriangle,
    label: 'Fair',
    description: 'Some data quality issues detected',
  },
  poor: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
    icon: XCircle,
    label: 'Poor',
    description: 'Significant data quality issues',
  },
};

export function DataQualityBadge({ quality, compact = false }: DataQualityBadgeProps) {
  const config = qualityConfig[quality.overallQuality];
  const Icon = config.icon;
  const validPercent = quality.totalTrades > 0 
    ? ((quality.validTrades / quality.totalTrades) * 100).toFixed(1)
    : '100';

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${config.bgColor} ${config.color} text-xs font-medium cursor-help`}>
              <Icon className="w-3 h-3" />
              <span>{config.label}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">{config.description}</p>
              <p className="text-xs text-muted-foreground">
                {validPercent}% valid trades ({quality.validTrades}/{quality.totalTrades})
              </p>
              {quality.outlierCount > 0 && (
                <p className="text-xs text-yellow-400">
                  {quality.outlierCount} outlier{quality.outlierCount > 1 ? 's' : ''} detected
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Card className={`border ${config.borderColor}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
          <span>Data Quality</span>
          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${config.bgColor} ${config.color} text-xs font-medium`}>
            <Icon className="w-3 h-3" />
            <span>{config.label}</span>
          </div>
        </CardTitle>
        <CardDescription className="text-xs">{config.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Valid Trades</p>
            <p className="font-medium">{quality.validTrades} / {quality.totalTrades}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Validation Rate</p>
            <p className="font-medium">{validPercent}%</p>
          </div>
        </div>

        {quality.outlierCount > 0 && (
          <div className="flex items-start gap-2 p-2 rounded-md bg-yellow-500/10 border border-yellow-500/20">
            <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs">
              <p className="font-medium text-yellow-400">Outliers Detected</p>
              <p className="text-muted-foreground">
                {quality.outlierCount} trade{quality.outlierCount > 1 ? 's' : ''} with unusual P&L values
              </p>
            </div>
          </div>
        )}

        {quality.hasNegativeEquity && (
          <div className="flex items-start gap-2 p-2 rounded-md bg-red-500/10 border border-red-500/20">
            <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs">
              <p className="font-medium text-red-400">Negative Equity Warning</p>
              <p className="text-muted-foreground">
                Account went below zero (lowest: ${quality.lowestEquity.toLocaleString()})
              </p>
            </div>
          </div>
        )}

        {quality.dataIssues.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Issues Found:</p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {quality.dataIssues.slice(0, 3).map((issue, i) => (
                <li key={i} className="flex items-start gap-1">
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>{issue}</span>
                </li>
              ))}
              {quality.dataIssues.length > 3 && (
                <li className="text-muted-foreground/70">
                  +{quality.dataIssues.length - 3} more issues
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DataQualityBadge;
