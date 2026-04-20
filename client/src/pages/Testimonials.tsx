/**
 * /testimonials — subscriber testimonials page.
 *
 * Placeholder structure until real reviews arrive. Once we have 5+
 * verified testimonials, we add Review + AggregateRating schema and
 * get rich-result-eligible in Google Search. Never fabricate reviews
 * — schema fraud is a delisting risk.
 */
import { Link } from "wouter";
import { SEOHead } from "@/components/SEOHead";
import { SEOStructured } from "@/components/SEOStructured";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Quote, ArrowRight, Star } from "lucide-react";

interface Testimonial {
  name: string;
  tier?: string;
  body: string;
  subscribedSince?: string;
  rating?: number; // 1-5
}

// When you collect real subscriber testimonials (with explicit consent
// to publish), add them here. Each one should be real, verifiable if
// subpoena'd, and consented. Never invent testimonials.
const TESTIMONIALS: Testimonial[] = [];

export default function Testimonials() {
  const hasTestimonials = TESTIMONIALS.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="What Subscribers Say — STS Futures"
        description="Real subscriber testimonials about trading STS Futures NQ signals. Verified reviews from active traders."
        canonical="https://stsdashboard.com/testimonials"
        keywords="sts futures reviews, sts futures testimonials, nq signals reviews"
        noindex={!hasTestimonials}
      />
      <SEOStructured
        path="/testimonials"
        title="STS Futures Testimonials"
        description="Subscriber reviews and testimonials."
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Testimonials", url: "/testimonials" },
        ]}
      />

      <main className="container max-w-4xl mx-auto px-4 py-12 md:py-16">
        <header className="mb-10 text-center">
          <p className="text-emerald-600 dark:text-emerald-400 font-semibold tracking-wide uppercase text-xs mb-3">
            Testimonials
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            What subscribers say
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Every testimonial here is from a real subscriber, verified, and
            published with explicit consent. No fake reviews, no ghost-
            written copy, no aggregate ratings that don&apos;t exist.
          </p>
        </header>

        {hasTestimonials ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-16">
            {TESTIMONIALS.map((t, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Quote className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mb-3 opacity-60" />
                  {t.rating && (
                    <div className="flex gap-0.5 mb-3">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star
                          key={n}
                          className={`w-4 h-4 ${
                            n <= t.rating!
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                  <p className="text-base mb-4 leading-relaxed">
                    &ldquo;{t.body}&rdquo;
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t">
                    <span className="font-semibold text-foreground">
                      {t.name}
                    </span>
                    {t.subscribedSince && (
                      <span>Subscribed since {t.subscribedSince}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed mb-16">
            <CardContent className="p-10 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                We&apos;re in the process of collecting verified testimonials
                from current subscribers. The page will populate as real
                reviews come in &mdash; we won&apos;t use stock photos or
                fabricated quotes.
              </p>
              <p className="text-xs text-muted-foreground">
                In the meantime, the best &ldquo;testimonial&rdquo; is the
                15-year backtest itself, which is visible to every
                subscriber with full trade detail.
              </p>
            </CardContent>
          </Card>
        )}

        <section className="bg-gradient-to-br from-emerald-600 to-cyan-700 text-white rounded-2xl p-10 text-center">
          <h2 className="text-2xl font-bold mb-2">
            Try it yourself for 30 days
          </h2>
          <p className="opacity-90 mb-6 max-w-xl mx-auto">
            Our 15-day money-back guarantee plus cancel-anytime means you
            can evaluate the strategy with real money and get a refund if
            it&apos;s not for you.
          </p>
          <Link href="/pricing">
            <Button className="bg-white text-emerald-700 hover:bg-emerald-50">
              $50/month &mdash; cancel anytime
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </section>

        <p className="text-[11px] text-muted-foreground text-center mt-10">
          Are you a current subscriber willing to share a testimonial?
          Email <a href="mailto:rgorham369@gmail.com" className="underline">rgorham369@gmail.com</a>
          &mdash; we offer one free month in exchange for a verified review
          you allow us to publish.
        </p>
      </main>
    </div>
  );
}
