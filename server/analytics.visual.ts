/**
 * Visual Analytics Module
 * Provides data structures for charts and visualizations
 */

import { Trade } from './analytics.js';

export interface StreakDistribution {
  winStreaks: { length: number; count: number }[];
  lossStreaks: { length: number; count: number }[];
}

export interface DurationDistribution {
  buckets: { label: string; count: number; avgPnL: number }[];
}

export interface DayOfWeekPerformance {
  dayOfWeek: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnL: number;
  avgPnL: number;
}

/**
 * Calculate consecutive wins/losses distribution
 */
export function calculateStreakDistribution(trades: Trade[]): StreakDistribution {
  if (trades.length === 0) {
    return { winStreaks: [], lossStreaks: [] };
  }

  // Sort trades by exit date
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime()
  );

  const winStreaks: number[] = [];
  const lossStreaks: number[] = [];
  
  let currentStreak = 0;
  let isWinStreak = sortedTrades[0]!.pnl > 0;

  for (const trade of sortedTrades) {
    const isWin = trade.pnl > 0;
    
    if (isWin === isWinStreak) {
      currentStreak++;
    } else {
      // Streak ended, record it
      if (currentStreak > 0) {
        if (isWinStreak) {
          winStreaks.push(currentStreak);
        } else {
          lossStreaks.push(currentStreak);
        }
      }
      currentStreak = 1;
      isWinStreak = isWin;
    }
  }

  // Record final streak
  if (currentStreak > 0) {
    if (isWinStreak) {
      winStreaks.push(currentStreak);
    } else {
      lossStreaks.push(currentStreak);
    }
  }

  // Count occurrences of each streak length
  const countStreaks = (streaks: number[]) => {
    const counts = new Map<number, number>();
    for (const length of streaks) {
      counts.set(length, (counts.get(length) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([length, count]) => ({ length, count }))
      .sort((a, b) => a.length - b.length);
  };

  return {
    winStreaks: countStreaks(winStreaks),
    lossStreaks: countStreaks(lossStreaks),
  };
}

/**
 * Calculate trade duration distribution
 * Uses absolute value of duration to handle timezone/data issues
 * Buckets are designed for intraday trading (max 8h typical session)
 */
export function calculateDurationDistribution(trades: Trade[]): DurationDistribution {
  if (trades.length === 0) {
    return { buckets: [] };
  }

  // Define duration buckets for intraday trading (in minutes)
  // Most intraday trades should be under 8 hours
  const buckets = [
    { min: 0, max: 15, label: '<15m' },
    { min: 15, max: 30, label: '15-30m' },
    { min: 30, max: 60, label: '30m-1h' },
    { min: 60, max: 120, label: '1-2h' },
    { min: 120, max: 240, label: '2-4h' },
    { min: 240, max: 480, label: '4-8h' },
  ];

  const bucketData = buckets.map(bucket => ({
    label: bucket.label,
    count: 0,
    totalPnL: 0,
    avgPnL: 0,
  }));

  for (const trade of trades) {
    // Use absolute value to handle any timezone/data issues where exit appears before entry
    const durationMs = Math.abs(new Date(trade.exitDate).getTime() - new Date(trade.entryDate).getTime());
    const durationMinutes = durationMs / (1000 * 60);
    
    // Cap at 8 hours for intraday - anything longer goes in the last bucket
    const cappedDuration = Math.min(durationMinutes, 479);
    const bucketIndex = buckets.findIndex(b => cappedDuration >= b.min && cappedDuration < b.max);
    
    if (bucketIndex !== -1) {
      bucketData[bucketIndex]!.count++;
      bucketData[bucketIndex]!.totalPnL += trade.pnl / 100; // Convert cents to dollars
    }
  }

  // Calculate averages
  for (const bucket of bucketData) {
    if (bucket.count > 0) {
      bucket.avgPnL = bucket.totalPnL / bucket.count;
    }
  }

  // Filter out empty buckets for cleaner display
  return { buckets: bucketData.filter(b => b.count > 0) };
}

/**
 * Calculate win/loss performance by day of week
 */
export function calculateDayOfWeekPerformance(trades: Trade[]): DayOfWeekPerformance[] {
  if (trades.length === 0) {
    return [];
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayData = dayNames.map(day => ({
    dayOfWeek: day,
    trades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalPnL: 0,
    avgPnL: 0,
  }));

  for (const trade of trades) {
    const dayIndex = new Date(trade.exitDate).getDay();
    dayData[dayIndex]!.trades++;
    
    if (trade.pnl > 0) {
      dayData[dayIndex]!.wins++;
    } else if (trade.pnl < 0) {
      dayData[dayIndex]!.losses++;
    }
    
    dayData[dayIndex]!.totalPnL += trade.pnl / 100; // Convert cents to dollars
  }

  // Calculate averages and win rates
  for (const day of dayData) {
    if (day.trades > 0) {
      day.avgPnL = day.totalPnL / day.trades;
      day.winRate = (day.wins / day.trades) * 100;
    }
  }

  // Filter out days with no trades
  return dayData.filter(day => day.trades > 0);
}
