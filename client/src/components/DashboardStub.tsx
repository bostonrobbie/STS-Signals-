/**
 * DashboardStub — reusable "Connect X to enable" placeholder card used by
 * the business dashboard for data sources that are not yet wired to an
 * external provider (GA4, Google Ads, Meta, PostHog, Search Console, etc).
 *
 * When Rob is ready to connect one, we swap this for a real query.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plug, ExternalLink } from "lucide-react";

interface DashboardStubProps {
  icon?: React.ReactNode;
  title: string;
  /** One-line explanation of what this card will show once connected. */
  summary: string;
  /** Name of the source to connect, e.g. "Google Analytics 4" */
  source: string;
  /** Setup URL or doc link */
  setupUrl?: string;
  /** What env vars or settings flip this on */
  envHint?: string;
}

export function DashboardStub({
  icon,
  title,
  summary,
  source,
  setupUrl,
  envHint,
}: DashboardStubProps) {
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          <Badge variant="outline" className="text-[10px] font-normal">
            <Plug className="w-3 h-3 mr-1" />
            Not connected
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {summary}
        </p>
        <div className="text-[11px] text-muted-foreground/80 flex flex-col gap-1 pt-2 border-t">
          <div>
            <span className="font-semibold">Source:</span> {source}
          </div>
          {envHint && (
            <div>
              <span className="font-semibold">Env vars:</span>{" "}
              <code className="font-mono text-[10px] bg-muted px-1 rounded">
                {envHint}
              </code>
            </div>
          )}
          {setupUrl && (
            <a
              href={setupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 w-fit"
            >
              Setup guide
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
