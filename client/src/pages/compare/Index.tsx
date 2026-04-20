/**
 * /compare — comparison index page.
 * Hub linking to each STS Futures vs-competitor page.
 */
import { Link } from "wouter";
import { SEOHead } from "@/components/SEOHead";
import { SEOStructured } from "@/components/SEOStructured";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const COMPETITORS = [
  {
    slug: "signalstack",
    name: "SignalStack",
    tagline:
      "Execution-routing platform. Bring your own strategy — SignalStack executes it in your broker via webhook.",
  },
  {
    slug: "traderspost",
    name: "TradersPost",
    tagline:
      "Webhook-to-broker automation like SignalStack. Same category, different pricing tiers.",
  },
  {
    slug: "discord-signal-services",
    name: "Discord signal services",
    tagline:
      "The general category — human traders posting calls in a Discord room. No published track records, usually with upsells.",
  },
];

export default function CompareIndex() {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Compare STS Futures vs Other NQ Signal Services"
        description="Honest side-by-side comparisons of STS Futures against SignalStack, TradersPost, and generic Discord signal services. Transparent methodology, pricing, and feature tables."
        canonical="https://stsdashboard.com/compare"
        keywords="sts futures comparison, nq signal service comparison, best futures signals"
      />
      <SEOStructured
        path="/compare"
        title="STS Futures Comparisons"
        description="Side-by-side feature + price comparisons with other NQ signal services."
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Compare", url: "/compare" },
        ]}
      />

      <main className="container max-w-3xl mx-auto px-4 py-12 md:py-16">
        <header className="mb-10">
          <p className="text-emerald-600 dark:text-emerald-400 font-semibold tracking-wide uppercase text-xs mb-3">
            Compare
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            STS Futures vs the alternatives
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Side-by-side, feature-by-feature, honestly. Pick the competitor
            you&apos;re evaluating and see exactly how STS Futures stacks up
            on pricing, methodology, backtest transparency, and broker
            support.
          </p>
        </header>

        <div className="space-y-4">
          {COMPETITORS.map(c => (
            <Link key={c.slug} href={`/compare/${c.slug}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h2 className="text-xl font-bold mb-1">
                        STS Futures vs {c.name}
                      </h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {c.tagline}
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Comparing us to someone not listed? Email us and we&apos;ll add
            an honest comparison page.
          </p>
          <Link href="/pricing">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Skip comparisons — see pricing
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
