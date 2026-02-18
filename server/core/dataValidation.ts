/**
 * Data Validation & Robustness Module
 * 
 * Provides utilities for:
 * - Trade data validation
 * - Outlier detection
 * - Negative equity protection
 * - Data consistency checks
 */

import { Trade } from '../analytics';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface OutlierResult {
  trade: Trade;
  reason: string;
  zScore: number;
}

/**
 * Validates a single trade for data integrity
 */
export function validateTrade(trade: Trade): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!trade.id) errors.push('Missing trade ID');
  if (!trade.strategyId) errors.push('Missing strategy ID');
  if (!trade.entryDate) errors.push('Missing entry date');
  if (!trade.exitDate) errors.push('Missing exit date');
  if (!trade.direction) errors.push('Missing direction');
  if (trade.entryPrice === undefined || trade.entryPrice === null) errors.push('Missing entry price');
  if (trade.exitPrice === undefined || trade.exitPrice === null) errors.push('Missing exit price');
  if (trade.quantity === undefined || trade.quantity === null) errors.push('Missing quantity');

  // Date validation
  if (trade.entryDate && trade.exitDate) {
    if (trade.exitDate < trade.entryDate) {
      errors.push(`Exit date (${trade.exitDate.toISOString()}) is before entry date (${trade.entryDate.toISOString()})`);
    }
    
    // Warn if trade duration is unusually long (> 24 hours for intraday)
    const durationMs = trade.exitDate.getTime() - trade.entryDate.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    if (durationHours > 24) {
      warnings.push(`Trade duration (${durationHours.toFixed(1)} hours) exceeds 24 hours - verify this is intended`);
    }
  }

  // Price validation
  if (trade.entryPrice !== undefined && trade.entryPrice < 0) {
    errors.push(`Entry price (${trade.entryPrice}) cannot be negative`);
  }
  if (trade.exitPrice !== undefined && trade.exitPrice < 0) {
    errors.push(`Exit price (${trade.exitPrice}) cannot be negative`);
  }

  // Direction validation
  if (trade.direction && !['Long', 'Short'].includes(trade.direction)) {
    errors.push(`Invalid direction: ${trade.direction}. Must be 'Long' or 'Short'`);
  }

  // P&L consistency check
  if (trade.direction && trade.entryPrice !== undefined && trade.exitPrice !== undefined) {
    const expectedPnlSign = trade.direction === 'Long' 
      ? (trade.exitPrice > trade.entryPrice ? 1 : -1)
      : (trade.exitPrice < trade.entryPrice ? 1 : -1);
    
    if (trade.pnl !== 0 && Math.sign(trade.pnl) !== expectedPnlSign) {
      warnings.push(`P&L sign (${trade.pnl > 0 ? 'positive' : 'negative'}) doesn't match expected based on direction and prices`);
    }
  }

  // Quantity validation
  if (trade.quantity !== undefined && trade.quantity <= 0) {
    errors.push(`Quantity (${trade.quantity}) must be positive`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates an array of trades and returns aggregate results
 */
export function validateTrades(trades: Trade[]): {
  validTrades: Trade[];
  invalidTrades: { trade: Trade; result: ValidationResult }[];
  totalErrors: number;
  totalWarnings: number;
} {
  const validTrades: Trade[] = [];
  const invalidTrades: { trade: Trade; result: ValidationResult }[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const trade of trades) {
    const result = validateTrade(trade);
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;

    if (result.isValid) {
      validTrades.push(trade);
    } else {
      invalidTrades.push({ trade, result });
    }
  }

  return {
    validTrades,
    invalidTrades,
    totalErrors,
    totalWarnings
  };
}

/**
 * Detects statistical outliers in trade P&L using Z-score method
 * 
 * @param trades Array of trades
 * @param threshold Z-score threshold (default 3.0 = 3 standard deviations)
 */
export function detectOutliers(trades: Trade[], threshold: number = 3.0): OutlierResult[] {
  if (trades.length < 3) return []; // Need at least 3 trades for meaningful stats

  const pnlValues = trades.map(t => t.pnl / 100); // Convert to dollars
  
  // Calculate mean and standard deviation
  const mean = pnlValues.reduce((sum, p) => sum + p, 0) / pnlValues.length;
  const variance = pnlValues.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / (pnlValues.length - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return []; // All trades have same P&L

  const outliers: OutlierResult[] = [];

  for (let i = 0; i < trades.length; i++) {
    const pnl = pnlValues[i]!;
    const zScore = (pnl - mean) / stdDev;

    if (Math.abs(zScore) > threshold) {
      const trade = trades[i]!;
      outliers.push({
        trade,
        reason: zScore > 0 
          ? `Unusually large win ($${pnl.toFixed(2)}, ${zScore.toFixed(1)} std devs above mean)`
          : `Unusually large loss ($${pnl.toFixed(2)}, ${Math.abs(zScore).toFixed(1)} std devs below mean)`,
        zScore
      });
    }
  }

  return outliers.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
}

/**
 * Checks for negative equity scenarios in a trade sequence
 * 
 * @param trades Array of trades sorted by exit date
 * @param startingCapital Starting capital in dollars
 * @returns Object with negative equity detection results
 */
export function checkNegativeEquity(
  trades: Trade[],
  startingCapital: number
): {
  hasNegativeEquity: boolean;
  lowestEquity: number;
  lowestEquityDate: Date | null;
  lowestEquityTrade: Trade | null;
} {
  let equity = startingCapital;
  let lowestEquity = startingCapital;
  let lowestEquityDate: Date | null = null;
  let lowestEquityTrade: Trade | null = null;
  let hasNegativeEquity = false;

  // Sort by exit date
  const sortedTrades = [...trades].sort(
    (a, b) => a.exitDate.getTime() - b.exitDate.getTime()
  );

  for (const trade of sortedTrades) {
    equity += trade.pnl / 100; // Convert cents to dollars

    if (equity < lowestEquity) {
      lowestEquity = equity;
      lowestEquityDate = trade.exitDate;
      lowestEquityTrade = trade;
    }

    if (equity < 0) {
      hasNegativeEquity = true;
    }
  }

  return {
    hasNegativeEquity,
    lowestEquity,
    lowestEquityDate,
    lowestEquityTrade
  };
}

/**
 * Detects potential data errors in trade sequence
 * 
 * @param trades Array of trades
 * @returns Array of potential issues found
 */
export function detectDataIssues(trades: Trade[]): string[] {
  const issues: string[] = [];

  if (trades.length === 0) return issues;

  // Sort by exit date
  const sortedTrades = [...trades].sort(
    (a, b) => a.exitDate.getTime() - b.exitDate.getTime()
  );

  // Check for duplicate trades (same entry/exit time and price)
  const seen = new Set<string>();
  for (const trade of sortedTrades) {
    const key = `${trade.entryDate.getTime()}-${trade.exitDate.getTime()}-${trade.entryPrice}-${trade.exitPrice}`;
    if (seen.has(key)) {
      issues.push(`Potential duplicate trade found: Entry ${trade.entryDate.toISOString()}, Exit ${trade.exitDate.toISOString()}`);
    }
    seen.add(key);
  }

  // Check for large gaps between trades (> 30 days)
  for (let i = 1; i < sortedTrades.length; i++) {
    const prevTrade = sortedTrades[i - 1]!;
    const currTrade = sortedTrades[i]!;
    const gapDays = (currTrade.exitDate.getTime() - prevTrade.exitDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (gapDays > 30) {
      issues.push(`Large gap (${gapDays.toFixed(0)} days) between trades: ${prevTrade.exitDate.toISOString()} to ${currTrade.exitDate.toISOString()}`);
    }
  }

  // Check for trades on weekends (potential timestamp issues)
  for (const trade of sortedTrades) {
    const exitDay = trade.exitDate.getUTCDay();
    if (exitDay === 0 || exitDay === 6) {
      issues.push(`Trade exit on weekend: ${trade.exitDate.toISOString()} (${exitDay === 0 ? 'Sunday' : 'Saturday'})`);
    }
  }

  // Check for zero P&L trades (might be data errors)
  const zeroPnlTrades = sortedTrades.filter(t => t.pnl === 0);
  if (zeroPnlTrades.length > sortedTrades.length * 0.1) { // More than 10%
    issues.push(`High number of zero P&L trades: ${zeroPnlTrades.length} out of ${sortedTrades.length} (${((zeroPnlTrades.length / sortedTrades.length) * 100).toFixed(1)}%)`);
  }

  return issues;
}

/**
 * Generates a data quality report for a set of trades
 */
export function generateDataQualityReport(
  trades: Trade[],
  startingCapital: number = 100000
): {
  totalTrades: number;
  validTrades: number;
  invalidTrades: number;
  outlierCount: number;
  dataIssues: string[];
  hasNegativeEquity: boolean;
  lowestEquity: number;
  overallQuality: 'excellent' | 'good' | 'fair' | 'poor';
} {
  const validation = validateTrades(trades);
  const outliers = detectOutliers(validation.validTrades);
  const dataIssues = detectDataIssues(validation.validTrades);
  const equityCheck = checkNegativeEquity(validation.validTrades, startingCapital);

  // Calculate overall quality score
  const invalidRatio = validation.invalidTrades.length / trades.length;
  const outlierRatio = outliers.length / trades.length;
  const issueCount = dataIssues.length;

  let overallQuality: 'excellent' | 'good' | 'fair' | 'poor';
  if (invalidRatio === 0 && outlierRatio < 0.01 && issueCount === 0 && !equityCheck.hasNegativeEquity) {
    overallQuality = 'excellent';
  } else if (invalidRatio < 0.01 && outlierRatio < 0.02 && issueCount <= 2) {
    overallQuality = 'good';
  } else if (invalidRatio < 0.05 && outlierRatio < 0.05 && issueCount <= 5) {
    overallQuality = 'fair';
  } else {
    overallQuality = 'poor';
  }

  return {
    totalTrades: trades.length,
    validTrades: validation.validTrades.length,
    invalidTrades: validation.invalidTrades.length,
    outlierCount: outliers.length,
    dataIssues,
    hasNegativeEquity: equityCheck.hasNegativeEquity,
    lowestEquity: equityCheck.lowestEquity,
    overallQuality
  };
}
