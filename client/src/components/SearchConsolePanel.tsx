/**
 * Admin tab — Google Search Console data.
 *
 * Pulls top queries, top pages, and overall summary from the
 * trpc.adminSearchConsole.* endpoints. If GSC isn't configured yet,
 * renders a friendly setup-instructions card instead.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  ExternalLink,
  Eye,
  MousePointerClick,
  Search,
  TrendingUp,
} from "lucide-react";

function formatPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

function formatPos(n: number): string {
  return n.toFixed(1);
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription className="text-xs uppercase tracking-wide">
            {label}
          </CardDescription>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {hint && (
          <p className="text-xs text-muted-foreground mt-1">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}

function SetupInstructions() {
  return (
    <Card className="border-yellow-500/40 bg-yellow-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          Search Console not configured yet
        </CardTitle>
        <CardDescription>
          The admin tab is wired and ready, but it needs four environment
          variables on Manus before it can pull data. One-time setup,
          ~10 minutes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ol className="space-y-2 list-decimal list-outside ml-5">
          <li>
            In{" "}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 inline-flex items-center gap-1"
            >
              Google Cloud Console
              <ExternalLink className="h-3 w-3" />
            </a>
            , create OAuth 2.0 Client ID credentials (type: "Desktop
            app"). Note the client ID + client secret.
          </li>
          <li>
            Enable the{" "}
            <a
              href="https://console.cloud.google.com/apis/library/searchconsole.googleapis.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 inline-flex items-center gap-1"
            >
              Search Console API
              <ExternalLink className="h-3 w-3" />
            </a>{" "}
            on the same project.
          </li>
          <li>
            Use{" "}
            <a
              href="https://developers.google.com/oauthplayground/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 inline-flex items-center gap-1"
            >
              Google's OAuth Playground
              <ExternalLink className="h-3 w-3" />
            </a>{" "}
            with your own credentials and the scope{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              https://www.googleapis.com/auth/webmasters.readonly
            </code>{" "}
            to obtain a refresh token.
          </li>
          <li>
            On Manus, add four env vars and restart:
            <pre className="bg-muted/50 rounded p-2 mt-2 text-xs overflow-x-auto">
              {`GSC_CLIENT_ID=...
GSC_CLIENT_SECRET=...
GSC_REFRESH_TOKEN=...
GSC_SITE_URL=https://stsdashboard.com/`}
            </pre>
          </li>
        </ol>
        <p className="text-xs text-muted-foreground pt-2">
          Without these vars, this tab stays in setup-mode. No errors,
          no impact on anything else. Full instructions live in
          server/services/searchConsoleService.ts.
        </p>
      </CardContent>
    </Card>
  );
}

export function SearchConsolePanel() {
  const [daysBack, setDaysBack] = useState<number>(28);

  const { data: status } = trpc.adminSearchConsole.status.useQuery();
  const isConfigured = status?.data?.configured ?? false;

  const { data: summary, isLoading: loadingSummary } =
    trpc.adminSearchConsole.summary.useQuery(
      { daysBack },
      { enabled: isConfigured }
    );
  const { data: queries, isLoading: loadingQueries } =
    trpc.adminSearchConsole.topQueries.useQuery(
      { daysBack, limit: 25 },
      { enabled: isConfigured }
    );
  const { data: pages, isLoading: loadingPages } =
    trpc.adminSearchConsole.topPages.useQuery(
      { daysBack, limit: 25 },
      { enabled: isConfigured }
    );

  if (!isConfigured) return <SetupInstructions />;

  const summaryData = (summary?.data as any)?.data;
  const queriesData = (queries?.data as any)?.data as
    | { query: string; clicks: number; impressions: number; ctr: number; position: number }[]
    | null;
  const pagesData = (pages?.data as any)?.data as
    | { page: string; clicks: number; impressions: number; ctr: number; position: number }[]
    | null;
  const summaryError = (summary?.data as any)?.error as string | undefined;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Window selector */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-lg">Search performance</h3>
          <p className="text-sm text-muted-foreground">
            What people search for when Google shows them STS Futures.
            Data comes from Google Search Console with a ~2-day lag.
          </p>
        </div>
        <Select
          value={String(daysBack)}
          onValueChange={v => setDaysBack(parseInt(v, 10))}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="28">Last 28 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary stats */}
      {summaryError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-6 text-sm">{summaryError}</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Clicks"
            value={
              loadingSummary ? "…" : (summaryData?.clicks ?? 0).toLocaleString()
            }
            hint={`Last ${daysBack} days`}
            icon={MousePointerClick}
          />
          <StatCard
            label="Impressions"
            value={
              loadingSummary
                ? "…"
                : (summaryData?.impressions ?? 0).toLocaleString()
            }
            hint={`Last ${daysBack} days`}
            icon={Eye}
          />
          <StatCard
            label="Avg CTR"
            value={loadingSummary ? "…" : formatPct(summaryData?.ctr ?? 0)}
            hint="Clicks ÷ impressions"
            icon={TrendingUp}
          />
          <StatCard
            label="Avg position"
            value={loadingSummary ? "…" : formatPos(summaryData?.position ?? 0)}
            hint="Lower = closer to #1"
            icon={Search}
          />
        </div>
      )}

      {/* Top queries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top search queries</CardTitle>
          <CardDescription>
            What people typed into Google before landing on the site.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingQueries ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !queriesData || queriesData.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No data yet for this window — Search Console takes a few days
              to accumulate after a new site launches, or after enabling.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Query</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead className="text-right">Impr.</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                    <TableHead className="text-right">Pos.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queriesData.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm">
                        {row.query}
                      </TableCell>
                      <TableCell className="text-right">{row.clicks}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {row.impressions.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="font-mono">
                          {formatPct(row.ctr)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatPos(row.position)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top pages */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top landing pages</CardTitle>
          <CardDescription>
            Which pages are actually being clicked from Google search.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPages ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !pagesData || pagesData.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No data yet for this window.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead className="text-right">Impr.</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                    <TableHead className="text-right">Pos.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagesData.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <a
                          href={row.page}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs underline underline-offset-2 hover:text-foreground"
                        >
                          {row.page.replace("https://stsdashboard.com", "")}
                        </a>
                      </TableCell>
                      <TableCell className="text-right">{row.clicks}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {row.impressions.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="font-mono">
                          {formatPct(row.ctr)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatPos(row.position)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Data freshness: Google Search Console publishes data with a ~2-day
        lag. CTR is fractional (0.05 = 5%). Position is the average rank
        in search results during the window.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Direct link</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <a
              href="https://search.google.com/search-console"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Search Console{" "}
              <ExternalLink className="ml-2 h-3 w-3" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default SearchConsolePanel;
