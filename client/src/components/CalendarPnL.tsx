import { memo } from "react";
import { Card } from "@/components/ui/card";

type PeriodType = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

interface BreakdownPeriod {
  period: string;
  returnPercent: number;
  totalPnL: number;
  trades: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
}

interface CalendarPnLProps {
  data: BreakdownPeriod[];
  periodType: PeriodType;
  onPeriodTypeChange: (type: PeriodType) => void;
}

export const CalendarPnL = memo(function CalendarPnL({
  data,
  periodType,
  onPeriodTypeChange,
}: CalendarPnLProps) {
  // Get color based on P&L value
  const getColor = (pnl: number, returnPct: number) => {
    if (pnl === 0) return "bg-muted/50 text-muted-foreground";

    const intensity = Math.min(Math.abs(returnPct) / 20, 1); // Cap at 20% for max intensity

    if (pnl > 0) {
      // Green shades
      if (intensity > 0.66) return "bg-green-600 text-white";
      if (intensity > 0.33) return "bg-green-500 text-white";
      return "bg-green-400 text-white";
    } else {
      // Red shades
      if (intensity > 0.66) return "bg-red-600 text-white";
      if (intensity > 0.33) return "bg-red-500 text-white";
      return "bg-red-400 text-white";
    }
  };

  // Format currency
  const formatCurrency = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1000) return `$${(value / 1000).toFixed(1)}k`;
    return `$${value.toFixed(0)}`;
  };

  // Render monthly calendar (for daily view)
  const renderMonthlyCalendar = () => {
    // Group data by month
    const monthGroups = data.reduce(
      (acc, item) => {
        const month = item.period.substring(0, 7); // YYYY-MM
        if (!acc[month]) acc[month] = [];
        acc[month].push(item);
        return acc;
      },
      {} as Record<string, BreakdownPeriod[]>
    );

    return (
      <div className="space-y-6">
        {Object.entries(monthGroups)
          .sort((a, b) => b[0].localeCompare(a[0])) // Sort descending (most recent first)
          .map(([month, days]) => {
            const [year, monthNum] = month.split("-");
            const monthName = new Date(
              parseInt(year),
              parseInt(monthNum) - 1
            ).toLocaleString("default", { month: "long", year: "numeric" });

            // Create a map of day number to data
            const dayMap = new Map<number, BreakdownPeriod>();
            days.forEach(day => {
              const dayNum = parseInt(day.period.split("-")[2]);
              dayMap.set(dayNum, day);
            });

            // Get first day of month and total days
            const firstDay = new Date(
              parseInt(year),
              parseInt(monthNum) - 1,
              1
            ).getDay();
            const daysInMonth = new Date(
              parseInt(year),
              parseInt(monthNum),
              0
            ).getDate();

            // Create calendar grid with all days
            const calendarCells: (BreakdownPeriod | null)[] = [];

            // Add empty cells for days before month starts
            for (let i = 0; i < firstDay; i++) {
              calendarCells.push(null);
            }

            // Add all days of the month
            for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
              calendarCells.push(dayMap.get(dayNum) || null);
            }

            return (
              <div key={month} className="space-y-2">
                <h3 className="text-lg font-semibold">{monthName}</h3>
                <div className="grid grid-cols-7 gap-1">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    day => (
                      <div
                        key={day}
                        className="text-center text-xs font-medium text-muted-foreground p-2"
                      >
                        {day}
                      </div>
                    )
                  )}
                  {calendarCells.map((day, idx) => (
                    <div
                      key={idx}
                      className={`min-h-[80px] p-2 rounded-md ${
                        day
                          ? getColor(day.totalPnL, day.returnPercent)
                          : "bg-muted/20"
                      }`}
                    >
                      {day && (
                        <div className="flex flex-col h-full">
                          <div className="text-xs font-medium">
                            {day.period.split("-")[2]}
                          </div>
                          <div className="text-sm font-bold mt-auto">
                            {formatCurrency(day.totalPnL)}
                          </div>
                          <div className="text-xs">
                            {day.returnPercent.toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {day.trades} trades
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
      </div>
    );
  };

  // Render weekly calendar (for weekly view)
  const renderWeeklyCalendar = () => {
    // Group weeks by month
    const monthGroups = data.reduce(
      (acc, item) => {
        // Parse week format: YYYY-Wxx
        const [yearStr, weekStr] = item.period.split("-W");
        const year = parseInt(yearStr);
        const week = parseInt(weekStr);

        // Get the first day of the week
        const firstDayOfYear = new Date(year, 0, 1);
        const daysOffset = (week - 1) * 7;
        const weekStart = new Date(firstDayOfYear);
        weekStart.setDate(
          firstDayOfYear.getDate() + daysOffset - firstDayOfYear.getDay()
        );

        const monthKey = `${year}-${(weekStart.getMonth() + 1).toString().padStart(2, "0")}`;
        if (!acc[monthKey]) {
          acc[monthKey] = {
            weeks: [],
            monthName: weekStart.toLocaleString("default", {
              month: "long",
              year: "numeric",
            }),
          };
        }
        acc[monthKey].weeks.push({ ...item, weekStart });
        return acc;
      },
      {} as Record<
        string,
        { weeks: (BreakdownPeriod & { weekStart: Date })[]; monthName: string }
      >
    );

    // Calculate month summaries
    const monthSummaries = Object.entries(monthGroups).map(
      ([key, { weeks, monthName }]) => {
        const totalPnL = weeks.reduce((sum, w) => sum + w.totalPnL, 0);
        const totalTrades = weeks.reduce((sum, w) => sum + w.trades, 0);
        const avgWinRate =
          weeks.length > 0
            ? weeks.reduce((sum, w) => sum + w.winRate, 0) / weeks.length
            : 0;
        const avgReturn =
          weeks.length > 0
            ? weeks.reduce((sum, w) => sum + w.returnPercent, 0) / weeks.length
            : 0;

        return {
          key,
          monthName,
          weeks: weeks.sort(
            (a, b) => a.weekStart.getTime() - b.weekStart.getTime()
          ),
          totalPnL,
          totalTrades,
          winRate: avgWinRate,
          avgReturn,
        };
      }
    );

    return (
      <div className="space-y-8">
        {monthSummaries
          .sort((a, b) => b.key.localeCompare(a.key))
          .map(
            ({
              key,
              monthName,
              weeks,
              totalPnL,
              totalTrades,
              winRate,
              avgReturn,
            }) => (
              <div key={key} className="space-y-3">
                {/* Month header with summary */}
                <div className="flex items-baseline justify-between border-b pb-2">
                  <h3 className="text-xl font-bold">{monthName}</h3>
                  <div className="flex items-center gap-4 text-sm">
                    <span
                      className={`font-bold ${
                        totalPnL > 0
                          ? "text-green-500"
                          : totalPnL < 0
                            ? "text-red-500"
                            : "text-muted-foreground"
                      }`}
                    >
                      {formatCurrency(totalPnL)}
                    </span>
                    <span className="text-muted-foreground">
                      {weeks.length} weeks • {totalTrades} trades
                    </span>
                    <span className="text-muted-foreground">
                      {avgReturn.toFixed(1)}% • WR: {winRate.toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Week cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {weeks.map((week, idx) => {
                    const weekEnd = new Date(week.weekStart);
                    weekEnd.setDate(weekEnd.getDate() + 6);
                    const dateRange = `${week.weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

                    return (
                      <div
                        key={`${week.period}-${week.weekStart.getTime()}-${idx}`}
                        className={`p-3 rounded-md ${getColor(week.totalPnL, week.returnPercent)} hover:opacity-90 transition-opacity`}
                      >
                        <div className="text-xs font-medium opacity-80">
                          {week.period}
                        </div>
                        <div className="text-xs opacity-70 mb-2">
                          {dateRange}
                        </div>
                        <div className="text-lg font-bold">
                          {formatCurrency(week.totalPnL)}
                        </div>
                        <div className="text-sm">
                          {week.returnPercent.toFixed(1)}%
                        </div>
                        <div className="text-xs mt-1 opacity-80">
                          {week.trades} trades
                        </div>
                        <div className="text-xs opacity-80">
                          WR: {week.winRate.toFixed(0)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
      </div>
    );
  };

  // Render year grid (for monthly/quarterly/yearly view)
  const renderYearGrid = () => {
    if (periodType === "monthly") {
      // Group by year
      const yearGroups = data.reduce(
        (acc, item) => {
          const year = item.period.substring(0, 4);
          if (!acc[year]) acc[year] = [];
          acc[year].push(item);
          return acc;
        },
        {} as Record<string, BreakdownPeriod[]>
      );

      return (
        <div className="space-y-6">
          {Object.entries(yearGroups)
            .sort((a, b) => b[0].localeCompare(a[0])) // Sort descending (most recent year first)
            .map(([year, months]) => (
              <div key={year} className="space-y-2">
                <h3 className="text-lg font-semibold">{year}</h3>
                <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                  {months
                    .sort((a, b) => a.period.localeCompare(b.period)) // Sort ascending (Jan → Dec) for natural reading
                    .map((month, idx) => {
                      const monthName = new Date(month.period).toLocaleString(
                        "default",
                        { month: "short" }
                      );
                      return (
                        <div
                          key={`${month.period}-${idx}`}
                          className={`p-4 rounded-md ${getColor(month.totalPnL, month.returnPercent)}`}
                        >
                          <div className="text-sm font-medium">{monthName}</div>
                          <div className="text-lg font-bold mt-2">
                            {formatCurrency(month.totalPnL)}
                          </div>
                          <div className="text-sm">
                            {month.returnPercent.toFixed(1)}%
                          </div>
                          <div className="text-xs mt-1 opacity-80">
                            {month.trades} trades
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
        </div>
      );
    }

    // For quarterly and yearly - sort chronologically
    const sortedData = [...data].sort((a, b) =>
      a.period.localeCompare(b.period)
    );
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {sortedData.map((item, idx) => (
          <div
            key={`${item.period}-${idx}`}
            className={`p-4 rounded-md ${getColor(item.totalPnL, item.returnPercent)}`}
          >
            <div className="text-sm font-medium">{item.period}</div>
            <div className="text-xl font-bold mt-2">
              {formatCurrency(item.totalPnL)}
            </div>
            <div className="text-sm">{item.returnPercent.toFixed(1)}%</div>
            <div className="text-xs mt-1 opacity-80">{item.trades} trades</div>
            <div className="text-xs opacity-80">
              WR: {item.winRate.toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header with tabs */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Calendar P&L</h2>
            <p className="text-sm text-muted-foreground">
              Performance visualization by time period
            </p>
          </div>
        </div>

        {/* Period type tabs */}
        <div className="flex gap-2 border-b">
          {(
            [
              "daily",
              "weekly",
              "monthly",
              "quarterly",
              "yearly",
            ] as PeriodType[]
          ).map(type => (
            <button
              key={type}
              onClick={() => onPeriodTypeChange(type)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                periodType === type
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Calendar view */}
        <div className="mt-6">
          {periodType === "daily"
            ? renderMonthlyCalendar()
            : periodType === "weekly"
              ? renderWeeklyCalendar()
              : renderYearGrid()}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-6 pt-4 border-t">
          <span>Color intensity indicates magnitude:</span>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-400 rounded"></div>
            <span>Small gain</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-600 rounded"></div>
            <span>Large gain</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-400 rounded"></div>
            <span>Small loss</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-600 rounded"></div>
            <span>Large loss</span>
          </div>
        </div>
      </div>
    </Card>
  );
});
