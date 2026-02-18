import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Filter, X } from 'lucide-react';

export interface TradeFilterState {
  startDate?: string;
  endDate?: string;
  direction?: 'long' | 'short' | 'all';
  minPnl?: number;
  maxPnl?: number;
  strategyId?: number;
}

interface TradeFiltersProps {
  filters: TradeFilterState;
  onFiltersChange: (filters: TradeFilterState) => void;
  onExportCSV: () => void;
  strategies?: Array<{ id: number; name: string }>;
  totalTrades: number;
  filteredTrades: number;
}

export function TradeFilters({
  filters,
  onFiltersChange,
  onExportCSV,
  strategies,
  totalTrades,
  filteredTrades,
}: TradeFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleReset = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Object.keys(filters).length > 0;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            {isExpanded ? 'Hide Filters' : 'Show Filters'}
          </Button>
          
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Clear Filters
            </Button>
          )}
          
          <span className="text-sm text-muted-foreground">
            Showing {filteredTrades.toLocaleString()} of {totalTrades.toLocaleString()} trades
          </span>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={onExportCSV}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t">
          <div className="space-y-2">
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => onFiltersChange({ ...filters, startDate: e.target.value || undefined })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="end-date">End Date</Label>
            <Input
              id="end-date"
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => onFiltersChange({ ...filters, endDate: e.target.value || undefined })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="direction">Direction</Label>
            <Select
              value={filters.direction || 'all'}
              onValueChange={(value) => 
                onFiltersChange({ 
                  ...filters, 
                  direction: value === 'all' ? undefined : value as 'long' | 'short' 
                })
              }
            >
              <SelectTrigger id="direction">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="long">Long</SelectItem>
                <SelectItem value="short">Short</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="min-pnl">Min P&L ($)</Label>
            <Input
              id="min-pnl"
              type="number"
              placeholder="e.g., -1000"
              value={filters.minPnl ?? ''}
              onChange={(e) => 
                onFiltersChange({ 
                  ...filters, 
                  minPnl: e.target.value ? parseFloat(e.target.value) : undefined 
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-pnl">Max P&L ($)</Label>
            <Input
              id="max-pnl"
              type="number"
              placeholder="e.g., 5000"
              value={filters.maxPnl ?? ''}
              onChange={(e) => 
                onFiltersChange({ 
                  ...filters, 
                  maxPnl: e.target.value ? parseFloat(e.target.value) : undefined 
                })
              }
            />
          </div>

          {strategies && strategies.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="strategy">Strategy</Label>
              <Select
                value={filters.strategyId?.toString() || 'all'}
                onValueChange={(value) => 
                  onFiltersChange({ 
                    ...filters, 
                    strategyId: value === 'all' ? undefined : parseInt(value) 
                  })
                }
              >
                <SelectTrigger id="strategy">
                  <SelectValue placeholder="All Strategies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Strategies</SelectItem>
                  {strategies.map((strategy) => (
                    <SelectItem key={strategy.id} value={strategy.id.toString()}>
                      {strategy.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
