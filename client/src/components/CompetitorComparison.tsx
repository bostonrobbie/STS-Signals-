/**
 * Shared layout for competitor-comparison pages (/vs/topstep, /vs/cannon).
 *
 * Each page just passes in the competitor-specific content; the hero,
 * comparison table, "when to pick which", FAQ, and CTA are consistent.
 *
 * Philosophy: honest, balanced. Don't trash-talk the competitor. Point
 * out clearly when they're the better choice. Builds trust faster than
 * a one-sided takedown, and it's genuinely useful to the reader.
 */

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, Minus, X } from "lucide-react";

export type Verdict = "yes" | "no" | "partial" | "na";

export interface ComparisonRow {
  dimension: string;
  sts: { verdict: Verdict; detail: string };
  competitor: { verdict: Verdict; detail: string };
}

export interface CompetitorFAQ {
  question: string;
  answer: string;
}

export interface WhenToPick {
  heading: string;
  bullets: string[];
}

export interface CompetitorComparisonProps {
  competitorName: string;
  competitorTagline: string;
  heroDescription: string;
  rows: ComparisonRow[];
  whenToPickSTS: WhenToPick;
  whenToPickCompetitor: WhenToPick;
  faqs: CompetitorFAQ[];
  /** Link to competitor's site — always nofollow + ugc rel attributes. */
  competitorUrl?: string;
}

function VerdictCell({ verdict, detail }: { verdict: Verdict; detail: string }) {
  const icon =
    verdict === "yes" ? (
      <Check className="h-4 w-4 text-green-500 shrink-0" />
    ) : verdict === "no" ? (
      <X className="h-4 w-4 text-destructive shrink-0" />
    ) : verdict === "partial" ? (
      <Minus className="h-4 w-4 text-yellow-500 shrink-0" />
    ) : (
      <Minus className="h-4 w-4 text-muted-foreground shrink-0" />
    );
  return (
    <div className="flex items-start gap-2">
      <div className="pt-0.5">{icon}</div>
      <span className="text-sm">{detail}</span>
    </div>
  );
}

export function CompetitorComparison(props: CompetitorComparisonProps) {
  const {
    competitorName,
    competitorTagline,
    heroDescription,
    rows,
    whenToPickSTS,
    whenToPickCompetitor,
    faqs,
    competitorUrl,
  } = props;

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8 sm:py-12 space-y-12 sm:space-y-16">
      {/* Hero */}
      <section className="text-center space-y-4">
        <Badge variant="outline" className="mb-2">
          Comparison
        </Badge>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
          STS Futures <span className="text-muted-foreground">vs</span>{" "}
          {competitorName}
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
          {heroDescription}
        </p>
        <p className="text-sm text-muted-foreground italic max-w-2xl mx-auto pt-2">
          This is an honest comparison. We'll tell you when {competitorName} is
          the better fit — signing up somewhere because it's wrong for you is
          worse than not signing up at all.
        </p>
      </section>

      {/* Side-by-side summary cards */}
      <section className="grid md:grid-cols-2 gap-4 sm:gap-6">
        <Card className="border-primary/40">
          <CardHeader>
            <Badge className="w-fit bg-primary/10 text-primary border-primary/30">
              STS Futures
            </Badge>
            <CardTitle className="mt-2 text-xl">
              Systematic NQ signals — keep your broker
            </CardTitle>
            <CardDescription>
              $50/mo. Signals delivered via dashboard + email. Execute
              through any futures broker you already use.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <Badge className="w-fit" variant="outline">
              {competitorName}
            </Badge>
            <CardTitle className="mt-2 text-xl">{competitorTagline}</CardTitle>
            {competitorUrl && (
              <CardDescription>
                <a
                  href={competitorUrl}
                  rel="nofollow noopener ugc"
                  target="_blank"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Visit {competitorName} site
                </a>
              </CardDescription>
            )}
          </CardHeader>
        </Card>
      </section>

      {/* Comparison table */}
      <section className="space-y-4">
        <h2 className="text-2xl sm:text-3xl font-bold">
          Feature-by-feature comparison
        </h2>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold w-[28%]">
                      Dimension
                    </th>
                    <th className="text-left px-4 py-3 font-semibold">
                      STS Futures
                    </th>
                    <th className="text-left px-4 py-3 font-semibold">
                      {competitorName}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={i}
                      className={
                        i < rows.length - 1 ? "border-b border-border/60" : ""
                      }
                    >
                      <td className="px-4 py-3 font-medium align-top">
                        {row.dimension}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <VerdictCell {...row.sts} />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <VerdictCell {...row.competitor} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* When to pick each */}
      <section className="grid md:grid-cols-2 gap-4 sm:gap-6">
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-lg">{whenToPickSTS.heading}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {whenToPickSTS.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {whenToPickCompetitor.heading}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {whenToPickCompetitor.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="text-2xl sm:text-3xl font-bold">Common questions</h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{faq.question}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {faq.answer}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center space-y-4 py-6">
        <h2 className="text-2xl sm:text-3xl font-bold">
          Ready to try STS Futures?
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Full dashboard is public — no signup required to look around.
          If it feels right, $50/month adds email alerts and full trade
          log access. Cancel anytime.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button asChild size="lg">
            <Link href="/pricing">
              See Pricing <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/overview">Open Live Dashboard</Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href="/faq">Read FAQ</Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground pt-4 max-w-2xl mx-auto">
          Trading futures involves substantial risk of loss and is not
          suitable for all investors. Past performance is not indicative
          of future results.
        </p>
      </section>
    </div>
  );
}
