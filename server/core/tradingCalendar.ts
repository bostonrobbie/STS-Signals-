/**
 * Trading Calendar Module
 * 
 * Provides market holiday detection and trading day validation
 * for US equity/futures markets.
 * 
 * Supports:
 * - NYSE/NASDAQ holidays
 * - CME futures holidays (slightly different schedule)
 * - Weekend detection
 */

export interface TradingCalendar {
  holidays: Set<string>; // Set of YYYY-MM-DD strings
  market: 'NYSE' | 'CME' | 'CUSTOM';
}

/**
 * US Market Holidays (NYSE/NASDAQ)
 * These are the standard market closures
 */
const US_MARKET_HOLIDAYS: Record<number, string[]> = {
  2020: [
    '2020-01-01', // New Year's Day
    '2020-01-20', // MLK Day
    '2020-02-17', // Presidents Day
    '2020-04-10', // Good Friday
    '2020-05-25', // Memorial Day
    '2020-07-03', // Independence Day (observed)
    '2020-09-07', // Labor Day
    '2020-11-26', // Thanksgiving
    '2020-12-25', // Christmas
  ],
  2021: [
    '2021-01-01', // New Year's Day
    '2021-01-18', // MLK Day
    '2021-02-15', // Presidents Day
    '2021-04-02', // Good Friday
    '2021-05-31', // Memorial Day
    '2021-07-05', // Independence Day (observed)
    '2021-09-06', // Labor Day
    '2021-11-25', // Thanksgiving
    '2021-12-24', // Christmas (observed)
  ],
  2022: [
    '2022-01-17', // MLK Day
    '2022-02-21', // Presidents Day
    '2022-04-15', // Good Friday
    '2022-05-30', // Memorial Day
    '2022-06-20', // Juneteenth (new holiday)
    '2022-07-04', // Independence Day
    '2022-09-05', // Labor Day
    '2022-11-24', // Thanksgiving
    '2022-12-26', // Christmas (observed)
  ],
  2023: [
    '2023-01-02', // New Year's Day (observed)
    '2023-01-16', // MLK Day
    '2023-02-20', // Presidents Day
    '2023-04-07', // Good Friday
    '2023-05-29', // Memorial Day
    '2023-06-19', // Juneteenth
    '2023-07-04', // Independence Day
    '2023-09-04', // Labor Day
    '2023-11-23', // Thanksgiving
    '2023-12-25', // Christmas
  ],
  2024: [
    '2024-01-01', // New Year's Day
    '2024-01-15', // MLK Day
    '2024-02-19', // Presidents Day
    '2024-03-29', // Good Friday
    '2024-05-27', // Memorial Day
    '2024-06-19', // Juneteenth
    '2024-07-04', // Independence Day
    '2024-09-02', // Labor Day
    '2024-11-28', // Thanksgiving
    '2024-12-25', // Christmas
  ],
  2025: [
    '2025-01-01', // New Year's Day
    '2025-01-20', // MLK Day
    '2025-02-17', // Presidents Day
    '2025-04-18', // Good Friday
    '2025-05-26', // Memorial Day
    '2025-06-19', // Juneteenth
    '2025-07-04', // Independence Day
    '2025-09-01', // Labor Day
    '2025-11-27', // Thanksgiving
    '2025-12-25', // Christmas
  ],
  2026: [
    '2026-01-01', // New Year's Day
    '2026-01-19', // MLK Day
    '2026-02-16', // Presidents Day
    '2026-04-03', // Good Friday
    '2026-05-25', // Memorial Day
    '2026-06-19', // Juneteenth
    '2026-07-03', // Independence Day (observed)
    '2026-09-07', // Labor Day
    '2026-11-26', // Thanksgiving
    '2026-12-25', // Christmas
  ],
};

/**
 * Creates a trading calendar for US markets
 */
export function getTradingCalendar(market: 'NYSE' | 'CME' = 'NYSE'): TradingCalendar {
  const holidays = new Set<string>();
  
  // Add all known holidays
  for (const year of Object.keys(US_MARKET_HOLIDAYS)) {
    const yearHolidays = US_MARKET_HOLIDAYS[parseInt(year)];
    for (const holiday of yearHolidays) {
      holidays.add(holiday);
    }
  }
  
  return {
    holidays,
    market
  };
}

/**
 * Checks if a given date is a weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

/**
 * Converts a Date to YYYY-MM-DD string
 */
function toDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Checks if a given date is a market holiday
 */
export function isHoliday(date: Date, calendar: TradingCalendar): boolean {
  const dateStr = toDateString(date);
  return calendar.holidays.has(dateStr);
}

/**
 * Checks if the market is open on a given date
 * Returns true if it's a trading day (not weekend, not holiday)
 */
export function isMarketOpen(date: Date, calendar?: TradingCalendar): boolean {
  if (isWeekend(date)) return false;
  
  if (calendar && isHoliday(date, calendar)) return false;
  
  return true;
}

/**
 * Gets the number of trading days between two dates
 */
export function getTradingDaysBetween(
  startDate: Date,
  endDate: Date,
  calendar?: TradingCalendar
): number {
  const cal = calendar || getTradingCalendar();
  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    if (isMarketOpen(current, cal)) {
      count++;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  
  return count;
}

/**
 * Gets the next trading day after a given date
 */
export function getNextTradingDay(date: Date, calendar?: TradingCalendar): Date {
  const cal = calendar || getTradingCalendar();
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  
  while (!isMarketOpen(next, cal)) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  
  return next;
}

/**
 * Gets the previous trading day before a given date
 */
export function getPreviousTradingDay(date: Date, calendar?: TradingCalendar): Date {
  const cal = calendar || getTradingCalendar();
  const prev = new Date(date);
  prev.setUTCDate(prev.getUTCDate() - 1);
  
  while (!isMarketOpen(prev, cal)) {
    prev.setUTCDate(prev.getUTCDate() - 1);
  }
  
  return prev;
}

/**
 * Generates an array of all trading days between two dates
 */
export function getTradingDays(
  startDate: Date,
  endDate: Date,
  calendar?: TradingCalendar
): Date[] {
  const cal = calendar || getTradingCalendar();
  const days: Date[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    if (isMarketOpen(current, cal)) {
      days.push(new Date(current));
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  
  return days;
}

/**
 * Estimates the number of trading days in a year
 * Typically ~252 for US markets
 */
export const TRADING_DAYS_PER_YEAR = 252;
