import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertCircle,
  Home,
  BookOpen,
  HelpCircle,
  Users,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { SEOHead } from "@/components/SEOHead";

const HELPFUL_LINKS = [
  {
    href: "/",
    icon: <Home className="w-4 h-4" />,
    title: "Homepage",
    desc: "The 15-year equity curve + live signal preview",
  },
  {
    href: "/pricing",
    icon: <BarChart3 className="w-4 h-4" />,
    title: "Pricing",
    desc: "$50/month · cancel anytime · 15-day money-back",
  },
  {
    href: "/how-it-works",
    icon: <HelpCircle className="w-4 h-4" />,
    title: "How it works",
    desc: "5-step walkthrough from subscribe to trade",
  },
  {
    href: "/blog",
    icon: <BookOpen className="w-4 h-4" />,
    title: "Blog",
    desc: "Weekly NQ market recaps + methodology deep-dives",
  },
  {
    href: "/about",
    icon: <Users className="w-4 h-4" />,
    title: "About Rob Gorham",
    desc: "Founder, systematic NQ trader for 10+ years",
  },
  {
    href: "/compare",
    icon: <BarChart3 className="w-4 h-4" />,
    title: "Compare alternatives",
    desc: "STS Futures vs SignalStack, TradersPost, Discord services",
  },
];

export default function NotFound() {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Page not found — STS Futures"
        description="We couldn't find that page. Try the homepage, pricing, blog, or contact support."
        canonical="https://stsdashboard.com/404"
        noindex
      />

      <main className="container max-w-3xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 text-destructive mb-5">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-3">
            404
          </h1>
          <p className="text-xl text-muted-foreground mb-2">
            That page doesn&apos;t exist.
          </p>
          <p className="text-sm text-muted-foreground">
            Requested:{" "}
            <code className="bg-muted px-2 py-1 rounded text-xs">
              {location}
            </code>
          </p>
        </div>

        <div className="mb-8">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Here&apos;s where you might have been headed
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {HELPFUL_LINKS.map(link => (
              <Link key={link.href} href={link.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0">
                      {link.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm mb-0.5">
                        {link.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {link.desc}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        <div className="text-center">
          <Button asChild>
            <Link href="/">
              <Home className="w-4 h-4 mr-2" />
              Back to homepage
            </Link>
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-10">
          Think this page should exist? Email{" "}
          <a href="mailto:rgorham369@gmail.com" className="underline">
            rgorham369@gmail.com
          </a>
          .
        </p>
      </main>
    </div>
  );
}
