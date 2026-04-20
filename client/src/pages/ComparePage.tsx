/**
 * Reusable competitor-comparison layout used by the three /compare/* routes.
 *
 * SEO + AEO goal: capture "STS Futures vs X" and "best NQ signal
 * service" type queries. Each page emits Product + BreadcrumbList +
 * FAQPage JSON-LD and publishes an honest side-by-side feature table.
 *
 * "Honest" is the operative word — we don't trash competitors. We state
 * verifiable differences (price, methodology, what's shown publicly).
 * That tone is what AI engines preferentially cite.
 */
import { SEOHead } from "@/components/SEOHead";
import { SEOStructured } from "@/components/SEOStructured";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Check, X, Minus, ArrowRight } from "lucide-react";

export interface CompareRow {
  feature: string;
  sts: string | boolean;
  competitor: string | boolean;
  note?: string;
}

export interface ComparePageProps {
  competitorName: string;
  competitorSlug: string; // route slug, e.g. "signalstack"
  competitorUrl?: string;
  oneLiner: string; // what the competitor does, one honest sentence
  summary: string; // 2-3 sentences comparing
  rows: CompareRow[];
  faqs: { q: string; a: string }[];
}

function Cell({ value }: { value: string | boolean }) {
  if (value === true)
    return <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-auto" />;
  if (value === false)
    return <X className="w-5 h-5 text-red-500 mx-auto" />;
  if (value === "" || value == null)
    return <Minus className="w-4 h-4 text-muted-foreground mx-auto" />;
  return <span className="text-sm">{value}</span>;
}

export function ComparePage(props: ComparePageProps) {
  const path = `/compare/${props.competitorSlug}`;
  const title = `STS Futures vs ${props.competitorName} — NQ Signal Service Comparison`;
  const description = `Honest side-by-side comparison of STS Futures and ${props.competitorName}: pricing, methodology, backtest transparency, execution, and broker support. ${props.summary}`;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={title}
        description={description}
        canonical={`https://stsdashboard.com${path}`}
        keywords={`sts futures vs ${props.competitorName.toLowerCase()}, ${props.competitorName.toLowerCase()} review, best nq futures signals, nq signals comparison`}
      />
      <SEOStructured
        path={path}
        title={title}
        description={description}
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Compare", url: "/compare" },
          { name: props.competitorName, url: path },
        ]}
        faqs={props.faqs}
        productOffer={{
          name: "STS Futures — NQ Trading Signals Subscription",
          price: 50,
          currency: "USD",
          sku: "sts-monthly",
        }}
      />

      <main className="container max-w-4xl mx-auto px-4 py-12 md:py-16">
        <header className="mb-12">
          <p className="text-emerald-600 dark:text-emerald-400 font-semibold tracking-wide uppercase text-xs mb-3">
            Comparison
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            STS Futures vs {props.competitorName}
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            {props.summary}
          </p>
        </header>

        <section className="mb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            In one sentence
          </h2>
          <Card>
            <CardContent className="p-6">
              <p className="text-base leading-relaxed">
                <strong>{props.competitorName}</strong> — {props.oneLiner}
              </p>
              <p className="text-base leading-relaxed mt-3">
                <strong>STS Futures</strong> — a systematic NQ (Nasdaq-100)
                futures signal service with a verified 15-year public backtest
                (7,960 trades), single $50/month tier, cancel anytime.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Feature-by-feature</h2>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left px-4 py-3 font-semibold">Feature</th>
                    <th className="px-4 py-3 font-semibold text-center">
                      STS Futures
                    </th>
                    <th className="px-4 py-3 font-semibold text-center">
                      {props.competitorName}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {props.rows.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">
                        {r.feature}
                        {r.note && (
                          <div className="text-xs text-muted-foreground mt-0.5 font-normal">
                            {r.note}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Cell value={r.sts} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Cell value={r.competitor} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground mt-3">
            Comparison data current as of April 2026. Feature sets change — if
            anything here is out of date, email rgorham369@gmail.com and
            we&apos;ll correct it.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Frequently asked questions</h2>
          <div className="space-y-3">
            {props.faqs.map((f, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-1.5">{f.q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {f.a}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="bg-gradient-to-br from-emerald-600 to-cyan-700 text-white rounded-2xl p-10 text-center">
          <h2 className="text-2xl font-bold mb-2">
            See the signals yourself
          </h2>
          <p className="opacity-90 mb-6 max-w-xl mx-auto">
            Every one of the 7,960 historical trades is visible to subscribers.
            15-day money-back guarantee on your first month.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/pricing">
              <Button className="bg-white text-emerald-700 hover:bg-emerald-50">
                Subscribe — $50/month
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            {props.competitorUrl && (
              <a
                href={props.competitorUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  className="border-white text-white hover:bg-white/10"
                >
                  Visit {props.competitorName}
                </Button>
              </a>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
