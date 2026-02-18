/**
 * Timezone utility for converting dates to NY EST (America/New_York)
 */

/**
 * Convert a Date object to NY EST timezone string
 * @param date - Date to convert
 * @param format - 'time' for time only, 'date' for date only, 'full' for both
 * @returns Formatted string in NY EST timezone
 */
export function toNYTime(
  date: Date,
  format: "time" | "date" | "full" = "time"
): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "America/New_York",
  };

  if (format === "time") {
    options.hour = "2-digit";
    options.minute = "2-digit";
    options.hour12 = true;
  } else if (format === "date") {
    options.year = "numeric";
    options.month = "short";
    options.day = "numeric";
  } else {
    options.year = "numeric";
    options.month = "short";
    options.day = "numeric";
    options.hour = "2-digit";
    options.minute = "2-digit";
    options.hour12 = true;
  }

  return new Intl.DateTimeFormat("en-US", options).format(date);
}

/**
 * Get current time in NY EST
 */
export function getNYTime(): Date {
  // Create a date in NY timezone
  const nyTimeString = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
  });
  return new Date(nyTimeString);
}

/**
 * Check if a date is within market hours (9:30 AM - 4:00 PM ET)
 */
export function isMarketHours(date: Date): boolean {
  const nyTime = new Date(
    date.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const hours = nyTime.getHours();
  const minutes = nyTime.getMinutes();

  // Market opens at 9:30 AM
  if (hours < 9 || (hours === 9 && minutes < 30)) {
    return false;
  }

  // Market closes at 4:00 PM
  if (hours >= 16) {
    return false;
  }

  return true;
}
