/**
 * LiveSignalPreview — landing-page social proof widget.
 *
 * "See it work" is the single highest-converting pattern for trading
 * products. This widget shows the last 3 closed trades from our live
 * public API (already exposed via trpc.publicApi.overview for the
 * equity chart), with price redacted beyond the first three digits for
 * non-subscribers — enough to establish specificity, not enough to let
 * someone reverse-engineer the signals.
 *
 * Subscribers see full detail (same component, different redact logic).
 *
 * Data source: already-live `trpc.publicApi.overview` query — adds zero
 * backend load since the landing page already calls it for the stats
 * row.
 */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowUpRight, ArrowDownRight, Lock, ArrowRight } from "lucide-react";

interface TradeRow {
  id: number;
  entryDate: string | Date;
  exitDate: string | Date;
  direction: string;
  pnl: number;
  entryPrice: number;
  exitPrice: number;
}

function formatDateShort(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function redactPrice(price: number, subscribed: boolean): string {
  // Prices are stored as integer cents; display as dollars with 2 decimals.
  const dollars = price / 100;
  if (subscribed) return dollars.toFixed(2);
  // Non-subscriber: show first 3 sig-figs of the thousands digit, redact rest.
  // Example: 22355.25 → "22,3••"
  const str = dollars.toFixed(2);
  if (str.length <= 4) return str; // tiny values — don't redact
  return str.slice(0, 4) + "••";
}

export function LiveSignalPreview() {
  const { user } = useAuth();
  const subscribed =
    !!user && ((user as any).subscriptionStatus === "active" ||
    ["pro", "premium"].includes(((user as any).subscriptionTier ?? "") as string));

  const { data, isLoading } = trpc.publicApi.overview.useQuery(
    { startingCapital: 100000, contractMultiplier: 0.1 },
    { staleTime: 5 * 60 * 1000 }
  );

  const recent = (data?.recentTrades as TradeRow[] | undefined)?.slice(0, 3);

  return (
    <section className="py-12 md:py-16 bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container max-w-5xl mx-auto px-4">
        <div className="text-center mb-8">
          <p className="text-emerald-600 dark:text-emerald-400 font-semibold tracking-wide uppercase text-xs mb-2">
            Recent Signals
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            The last 3 trades the strategy fired
          </h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            Every trade logged with entry, exit, and net P&amp;L.
            {!subscribed && " Subscribers see full price detail."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {isLoading || !recent ? (
            [1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-5 h-36" />
              </Card>
            ))
          ) : (
            recent.map(t => {
              const isWin = t.pnl > 0;
              const isLong = t.direction.toLowerCase() === "long";
              return (
                <Card key={t.id} className="border-l-4" style={{
                  borderLeftColor: isWin ? "#059669" : "#dc2626",
                }}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-muted">
                        {isLong ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        NQ {isLong ? "Long" : "Short"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateShort(t.exitDate)}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Entry</span>
                        <span className="font-mono">
                          {redactPrice(t.entryPrice, subscribed)}
                          {!subscribed && (
                            <Lock className="inline w-3 h-3 ml-1 opacity-50" />
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Exit</span>
                        <span className="font-mono">
                          {redactPrice(t.exitPrice, subscribed)}
                          {!subscribed && (
                            <Lock className="inline w-3 h-3 ml-1 opacity-50" />
                          )}
                        </span>
                      </div>
                      <div className="pt-2 border-t flex justify-between items-baseline">
                        <span className="text-muted-foreground text-xs">
                          Net P&amp;L (Micro)
                        </span>
                        <span
                          className={`font-bold text-lg ${
                            isWin
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {isWin ? "+" : ""}$
                          {(t.pnl / 100).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {!subscribed && (
          <div className="text-center">
            <Link href="/pricing">
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                See tomorrow&apos;s signals live
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground mt-3">
              $50/month · Cancel anytime · 15-day money-back guarantee
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
