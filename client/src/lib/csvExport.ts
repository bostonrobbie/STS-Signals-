/**
 * CSV Export Utility
 * Export trades data to CSV format
 */

export interface TradeForExport {
  entryDate: Date;
  exitDate: Date;
  direction: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  commission: number;
  strategyName?: string;
}

/**
 * Convert trades to CSV and trigger download
 */
export function exportTradesToCSV(trades: TradeForExport[], filename: string = 'trades.csv') {
  if (trades.length === 0) {
    alert('No trades to export');
    return;
  }

  // Define CSV headers
  const headers = [
    'Entry Date',
    'Entry Time',
    'Exit Date',
    'Exit Time',
    'Direction',
    'Entry Price',
    'Exit Price',
    'Quantity',
    'P&L ($)',
    'P&L (%)',
    'Commission ($)',
    'Strategy',
  ];

  // Convert trades to CSV rows
  const rows = trades.map((trade) => {
    const entryDate = new Date(trade.entryDate);
    const exitDate = new Date(trade.exitDate);

    return [
      entryDate.toLocaleDateString(),
      entryDate.toLocaleTimeString(),
      exitDate.toLocaleDateString(),
      exitDate.toLocaleTimeString(),
      trade.direction,
      formatPrice(trade.entryPrice),
      formatPrice(trade.exitPrice),
      trade.quantity.toString(),
      formatCurrency(trade.pnl / 100), // Convert from cents to dollars
      formatPercent(trade.pnlPercent / 10000), // Convert from basis points to percentage
      formatCurrency(trade.commission / 100), // Convert from cents to dollars
      trade.strategyName || '',
    ];
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => escapeCSVCell(cell)).join(',')),
  ].join('\n');

  // Create blob and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Format price with 2 decimal places
 */
function formatPrice(price: number): string {
  return (price / 100).toFixed(2);
}

/**
 * Format currency with $ sign
 */
function formatCurrency(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Format percentage
 */
function formatPercent(percent: number): string {
  return percent.toFixed(2);
}

/**
 * Escape CSV cell to handle commas, quotes, and newlines
 */
function escapeCSVCell(cell: string): string {
  if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

/**
 * Export summary statistics to CSV
 */
export function exportSummaryToCSV(
  summary: {
    totalTrades: number;
    winRate: number;
    profitFactor: number;
    totalPnL: number;
    avgWin: number;
    avgLoss: number;
    bestTrade: number;
    worstTrade: number;
  },
  filename: string = 'summary.csv'
) {
  const headers = ['Metric', 'Value'];
  const rows = [
    ['Total Trades', summary.totalTrades.toString()],
    ['Win Rate (%)', summary.winRate.toFixed(2)],
    ['Profit Factor', summary.profitFactor.toFixed(2)],
    ['Total P&L ($)', (summary.totalPnL / 100).toFixed(2)],
    ['Average Win ($)', (summary.avgWin / 100).toFixed(2)],
    ['Average Loss ($)', (summary.avgLoss / 100).toFixed(2)],
    ['Best Trade ($)', (summary.bestTrade / 100).toFixed(2)],
    ['Worst Trade ($)', (summary.worstTrade / 100).toFixed(2)],
  ];

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
