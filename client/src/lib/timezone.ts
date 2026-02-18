/**
 * Timezone utility for converting dates to user's timezone
 * Automatically detects user's timezone, defaults to NY EST (America/New_York)
 * Client-side version
 */

/**
 * Detect the user's timezone using the Intl API
 * Falls back to America/New_York if detection fails
 */
export function detectUserTimezone(): string {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) {
      return timezone;
    }
  } catch (error) {
    console.warn("[Timezone] Failed to detect user timezone:", error);
  }

  // Default to EST/EDT
  return "America/New_York";
}

/**
 * Get the timezone abbreviation (e.g., "EST", "EDT", "PST")
 */
export function getTimezoneAbbreviation(
  timezone?: string,
  date: Date = new Date()
): string {
  const tz = timezone || detectUserTimezone();

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    });

    const parts = formatter.formatToParts(date);
    const timeZonePart = parts.find(part => part.type === "timeZoneName");

    if (timeZonePart) {
      return timeZonePart.value;
    }
  } catch (error) {
    console.warn("[Timezone] Failed to get timezone abbreviation:", error);
  }

  return "EST"; // Default
}

/**
 * Convert a Date object to specified timezone string (defaults to user's timezone)
 * @param date - Date to convert
 * @param format - 'time' for time only, 'date' for date only, 'full' for both
 * @param timezone - Target timezone (defaults to user's detected timezone)
 * @returns Formatted string in specified timezone
 */
export function toUserTime(
  date: Date,
  format: "time" | "date" | "full" = "time",
  timezone?: string
): string {
  const tz = timezone || detectUserTimezone();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: tz,
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
 * Convert a Date object to NY EST timezone string (legacy function, kept for compatibility)
 * @param date - Date to convert
 * @param format - 'time' for time only, 'date' for date only, 'full' for both
 * @returns Formatted string in NY EST timezone
 */
export function toNYTime(
  date: Date,
  format: "time" | "date" | "full" = "time"
): string {
  return toUserTime(date, format, "America/New_York");
}

/**
 * Format time for display in user's timezone
 * @param date - Date to format
 * @param timezone - Target timezone (defaults to user's detected timezone)
 * @returns Time string in format "HH:MM AM/PM TZ"
 */
export function formatUserTime(date: Date | string, timezone?: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const tz = timezone || detectUserTimezone();
  const timeStr = toUserTime(d, "time", tz);
  const abbr = getTimezoneAbbreviation(tz, d);
  return `${timeStr} ${abbr}`;
}

/**
 * Format time for display in NY EST (legacy function, kept for compatibility)
 * @param date - Date to format
 * @returns Time string in format "HH:MM AM/PM"
 */
export function formatNYTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return toNYTime(d, "time");
}

/**
 * Format date and time for display in NY EST
 * @param date - Date to format
 * @returns Date and time string
 */
export function formatNYDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return toNYTime(d, "full");
}

/**
 * Format a date/time for trade entry/exit display
 * Shows: "02/06/2026 02:45 PM ET"
 */
export function formatTradeTime(
  dateInput: string | Date | number,
  timezone?: string
): string {
  const tz = timezone || detectUserTimezone();
  let date: Date;
  if (typeof dateInput === "string") {
    date = new Date(dateInput);
  } else if (typeof dateInput === "number") {
    date = new Date(dateInput);
  } else {
    date = dateInput;
  }

  if (isNaN(date.getTime())) {
    return "Invalid Date";
  }

  const formatted = toUserTime(date, "full", tz);
  const abbr = getTimezoneAbbreviation(tz, date);
  return `${formatted} ${abbr}`;
}

/**
 * Format a date/time for alert notifications
 * Shows: "Today 02:45 PM" or "Yesterday 11:30 AM" or "02/05 03:15 PM"
 */
export function formatAlertTime(
  dateInput: string | Date | number,
  timezone?: string
): string {
  const tz = timezone || detectUserTimezone();

  let date: Date;
  if (typeof dateInput === "string") {
    date = new Date(dateInput);
  } else if (typeof dateInput === "number") {
    date = new Date(dateInput);
  } else {
    date = dateInput;
  }

  if (isNaN(date.getTime())) {
    return "Invalid Date";
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  // Format time part
  const timeStr = toUserTime(date, "time", tz);

  // Less than 24 hours ago
  if (diffHours < 24 && now.getDate() === date.getDate()) {
    return `Today ${timeStr}`;
  }

  // Yesterday
  if (diffHours < 48 && now.getDate() - date.getDate() === 1) {
    return `Yesterday ${timeStr}`;
  }

  // Older - show date
  const dateStr = toUserTime(date, "date", tz);

  return `${dateStr} ${timeStr}`;
}

/**
 * Get a human-readable timezone display for UI
 * Shows: "Times shown in EST (Eastern Time)"
 */
export function getTimezoneDisplay(timezone?: string): string {
  const tz = timezone || detectUserTimezone();
  const abbr = getTimezoneAbbreviation(tz);

  // Map common timezone names to friendly names
  const friendlyNames: Record<string, string> = {
    "America/New_York": "Eastern Time",
    "America/Chicago": "Central Time",
    "America/Denver": "Mountain Time",
    "America/Los_Angeles": "Pacific Time",
    "America/Phoenix": "Arizona Time",
    "Europe/London": "London Time",
    "Europe/Paris": "Central European Time",
    "Asia/Tokyo": "Japan Time",
    "Asia/Shanghai": "China Time",
    "Australia/Sydney": "Sydney Time",
  };

  const friendlyName = friendlyNames[tz] || tz.replace(/_/g, " ");

  return `Times shown in ${abbr} (${friendlyName})`;
}

/**
 * Get current time in NY EST (legacy function, kept for compatibility)
 */
export function getNYTime(): Date {
  // Create a date in NY timezone
  const nyTimeString = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
  });
  return new Date(nyTimeString);
}
