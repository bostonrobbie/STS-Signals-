import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface MonthlyReturn {
  year: number;
  month: number;
  monthName: string;
  return: number;
  startEquity: number;
  endEquity: number;
}

interface MonthlyReturnsCalendarProps {
  monthlyReturns: MonthlyReturn[];
}

export function MonthlyReturnsCalendar({
  monthlyReturns,
}: MonthlyReturnsCalendarProps) {
  if (monthlyReturns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monthly Returns Calendar</CardTitle>
          <CardDescription>Monthly performance heatmap</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  // Group by year
  const yearGroups = new Map<number, MonthlyReturn[]>();
  for (const mr of monthlyReturns) {
    if (!yearGroups.has(mr.year)) {
      yearGroups.set(mr.year, []);
    }
    yearGroups.get(mr.year)!.push(mr);
  }

  // Get all years sorted descending
  const years = Array.from(yearGroups.keys()).sort((a, b) => b - a);

  // Get color for return percentage
  const getColor = (returnPct: number): string => {
    if (returnPct > 10) return "bg-green-600 text-white";
    if (returnPct > 5) return "bg-green-500 text-white";
    if (returnPct > 2) return "bg-green-400 text-white";
    if (returnPct > 0) return "bg-green-300 text-foreground";
    if (returnPct === 0) return "bg-gray-400 text-foreground";
    if (returnPct > -2) return "bg-red-300 text-foreground";
    if (returnPct > -5) return "bg-red-400 text-white";
    if (returnPct > -10) return "bg-red-500 text-white";
    return "bg-red-600 text-white";
  };

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Returns Calendar</CardTitle>
        <CardDescription>
          Monthly performance heatmap - green indicates positive returns, red
          indicates negative
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left p-2 font-medium">Year</th>
                {monthNames.map(month => (
                  <th key={month} className="text-center p-2 font-medium">
                    {month}
                  </th>
                ))}
                <th className="text-center p-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {years.map(year => {
                const yearData = yearGroups.get(year)!;

                // Create month map for quick lookup
                const monthMap = new Map<number, MonthlyReturn>();
                for (const mr of yearData) {
                  monthMap.set(mr.month, mr);
                }

                // Calculate year total
                const yearTotal = yearData.reduce(
                  (sum, mr) => sum + mr.return,
                  0
                );

                return (
                  <tr key={year}>
                    <td className="p-2 font-medium">{year}</td>
                    {monthNames.map((_, monthIdx) => {
                      const monthNum = monthIdx + 1;
                      const monthData = monthMap.get(monthNum);

                      if (!monthData) {
                        return (
                          <td key={monthNum} className="p-1">
                            <div className="h-12 flex items-center justify-center bg-gray-700 rounded text-gray-300 text-xs">
                              -
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td key={monthNum} className="p-1">
                          <div
                            className={`h-12 flex flex-col items-center justify-center rounded ${getColor(monthData.return)}`}
                            title={`${monthData.monthName} ${year}: ${monthData.return.toFixed(2)}%`}
                          >
                            <span className="text-xs font-semibold">
                              {monthData.return.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      );
                    })}
                    <td className="p-1">
                      <div
                        className={`h-12 flex items-center justify-center rounded font-bold ${getColor(yearTotal)}`}
                        title={`${year} Total: ${yearTotal.toFixed(2)}%`}
                      >
                        {yearTotal.toFixed(1)}%
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span>Legend:</span>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-600 rounded"></div>
            <span>&gt;10%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-400 rounded"></div>
            <span>0-10%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-400 rounded"></div>
            <span>0%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-400 rounded"></div>
            <span>0 to -10%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-600 rounded"></div>
            <span>&lt;-10%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
