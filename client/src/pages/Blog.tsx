/**
 * /blog — blog index page. Lists posts from /blog/manifest.json.
 *
 * Static-markdown approach: posts live as .md files under client/public/blog/
 * with metadata in manifest.json. Zero database changes — safe for Manus.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { SEOHead } from "@/components/SEOHead";
import { SEOStructured } from "@/components/SEOStructured";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, User, ArrowRight } from "lucide-react";

interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: string;
  updatedAt?: string;
  category?: string;
  tags?: string[];
  readingMinutes?: number;
  ogImage?: string;
  keywords?: string[];
}

interface Manifest {
  posts: BlogPost[];
  lastUpdated?: string;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function Blog() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/blog/manifest.json")
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setManifest)
      .catch(e => setError(`Failed to load blog manifest: ${e}`));
  }, []);

  const posts = manifest?.posts ?? [];
  const sorted = [...posts].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Blog — STS Futures | NQ Futures Trading Insights"
        description="Weekly NQ market recaps, strategy deep dives, and systematic trading analysis from Rob Gorham, founder of STS Futures."
        canonical="https://stsdashboard.com/blog"
        keywords="NQ futures blog, systematic trading blog, futures market analysis, Rob Gorham"
      />
      <SEOStructured
        path="/blog"
        title="STS Futures Blog"
        description="NQ market recaps, strategy deep dives, and systematic trading analysis."
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Blog", url: "/blog" },
        ]}
      />

      <main className="container max-w-4xl mx-auto px-4 py-12 md:py-16">
        <header className="mb-12">
          <p className="text-emerald-600 dark:text-emerald-400 font-semibold tracking-wide uppercase text-sm mb-3">
            STS Futures Blog
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            NQ futures, written honestly.
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Weekly market recaps, strategy deep dives, and systematic trading
            analysis. No hype, no upsells — just what actually happened and
            what worked.
          </p>
        </header>

        {error && (
          <Card className="border-destructive mb-6">
            <CardContent className="p-6 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        )}

        {!manifest && !error && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6 h-32" />
              </Card>
            ))}
          </div>
        )}

        {sorted.length === 0 && manifest && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No posts yet — first one coming soon.
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          {sorted.map(p => (
            <Link key={p.slug} href={`/blog/${p.slug}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6 md:p-8">
                  {p.category && (
                    <p className="text-xs font-semibold tracking-wide uppercase text-emerald-600 dark:text-emerald-400 mb-2">
                      {p.category}
                    </p>
                  )}
                  <h2 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight">
                    {p.title}
                  </h2>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    {p.excerpt}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      {p.author}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(p.publishedAt)}
                    </span>
                    {p.readingMinutes && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {p.readingMinutes} min read
                      </span>
                    )}
                    <span className="ml-auto inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      Read
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-16">
          New weekly recap posts drop every Friday around 4:30 PM ET.
        </p>
      </main>
    </div>
  );
}
