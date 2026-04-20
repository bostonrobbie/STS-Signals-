/**
 * /blog/:slug — individual blog post.
 *
 * Fetches the markdown file at /blog/<slug>.md + metadata from manifest.json,
 * renders it with a minimal safe markdown-to-HTML converter, and emits
 * Article + BlogPosting + Breadcrumb + FAQPage JSON-LD.
 */
import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { SEOHead } from "@/components/SEOHead";
import { SEOStructured } from "@/components/SEOStructured";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, ArrowLeft, ArrowRight } from "lucide-react";

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

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ─── Minimal safe markdown → HTML ──────────────────────────────────────
// Supports: # headings, **bold**, *italic*, [link](url), lists, tables,
// code fences, blockquotes, hr. No raw HTML, no <script> injection.
function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(s: string): string {
  let out = escape(s);
  // bold
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // italic
  out = out.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  // inline code
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  // [link](url)
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_m, label, url) =>
      `<a href="${escape(url)}" class="text-emerald-600 dark:text-emerald-400 underline hover:opacity-80">${label}</a>`
  );
  return out;
}

function renderMarkdown(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;
  const pushPara = (buf: string[]) => {
    if (buf.length === 0) return;
    out.push(
      `<p class="my-4 leading-relaxed">${renderInline(buf.join(" "))}</p>`
    );
    buf.length = 0;
  };
  let paraBuf: string[] = [];

  while (i < lines.length) {
    const line = lines[i];

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      pushPara(paraBuf);
      out.push('<hr class="my-8 border-border" />');
      i++;
      continue;
    }

    // Headings
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      pushPara(paraBuf);
      const level = heading[1].length;
      const size =
        level === 1
          ? "text-4xl mt-10 mb-6 font-bold tracking-tight"
          : level === 2
            ? "text-2xl mt-10 mb-4 font-bold"
            : level === 3
              ? "text-xl mt-6 mb-3 font-semibold"
              : "text-base mt-4 mb-2 font-semibold";
      out.push(`<h${level} class="${size}">${renderInline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    // Code fence
    if (/^```/.test(line)) {
      pushPara(paraBuf);
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(escape(lines[i]));
        i++;
      }
      out.push(
        `<pre class="my-4 p-4 rounded bg-muted text-xs overflow-x-auto"><code>${buf.join("\n")}</code></pre>`
      );
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      pushPara(paraBuf);
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(
        `<blockquote class="my-4 pl-4 border-l-4 border-emerald-500/50 italic text-muted-foreground">${renderInline(buf.join(" "))}</blockquote>`
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      pushPara(paraBuf);
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(
          `<li class="my-1">${renderInline(lines[i].replace(/^\d+\.\s+/, ""))}</li>`
        );
        i++;
      }
      out.push(`<ol class="list-decimal list-inside my-4 space-y-1 pl-2">${items.join("")}</ol>`);
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      pushPara(paraBuf);
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(
          `<li class="my-1">${renderInline(lines[i].replace(/^[-*]\s+/, ""))}</li>`
        );
        i++;
      }
      out.push(`<ul class="list-disc list-inside my-4 space-y-1 pl-2">${items.join("")}</ul>`);
      continue;
    }

    // Table (very basic: requires header + separator + rows)
    if (
      /^\|/.test(line) &&
      i + 1 < lines.length &&
      /^\|\s*[-:|\s]+\|/.test(lines[i + 1])
    ) {
      pushPara(paraBuf);
      const parseRow = (l: string) =>
        l
          .replace(/^\||\|$/g, "")
          .split("|")
          .map(c => c.trim());
      const header = parseRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        rows.push(parseRow(lines[i]));
        i++;
      }
      const thead = `<thead><tr>${header
        .map(h => `<th class="px-3 py-2 text-left text-xs font-semibold border-b">${renderInline(h)}</th>`)
        .join("")}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map(
          r =>
            `<tr>${r
              .map(c => `<td class="px-3 py-2 text-sm border-b border-border/50">${renderInline(c)}</td>`)
              .join("")}</tr>`
        )
        .join("")}</tbody>`;
      out.push(
        `<div class="my-6 overflow-x-auto"><table class="w-full text-sm">${thead}${tbody}</table></div>`
      );
      continue;
    }

    // Blank line
    if (/^\s*$/.test(line)) {
      pushPara(paraBuf);
      i++;
      continue;
    }

    // Default: accumulate into paragraph
    paraBuf.push(line);
    i++;
  }
  pushPara(paraBuf);

  return out.join("\n");
}

// Pick up to 3 related posts based on overlapping tags/category; fall back
// to most-recent posts if no overlap. Never returns the current post.
function pickRelated(all: BlogPost[], current: BlogPost, max = 3): BlogPost[] {
  const others = all.filter(p => p.slug !== current.slug);
  const currentTags = new Set(current.tags ?? []);
  const scored = others.map(p => {
    const overlap = (p.tags ?? []).filter(t => currentTags.has(t)).length;
    const sameCategory = p.category === current.category ? 1 : 0;
    return { post: p, score: overlap * 2 + sameCategory };
  });
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (
      new Date(b.post.publishedAt).getTime() -
      new Date(a.post.publishedAt).getTime()
    );
  });
  return scored.slice(0, max).map(s => s.post);
}

export default function BlogPost() {
  const [, params] = useRoute<{ slug: string }>("/blog/:slug");
  const slug = params?.slug;

  const [post, setPost] = useState<BlogPost | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [related, setRelated] = useState<BlogPost[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const manifestRes = await fetch("/blog/manifest.json");
        const manifest = await manifestRes.json();
        const all = manifest.posts as BlogPost[];
        const found = all.find(p => p.slug === slug);
        if (!found) {
          setError("Post not found");
          return;
        }
        setPost(found);
        setRelated(pickRelated(all, found, 3));
        const mdRes = await fetch(`/blog/${slug}.md`);
        if (!mdRes.ok) {
          setError(`Failed to load post content (${mdRes.status})`);
          return;
        }
        const md = await mdRes.text();
        setHtml(renderMarkdown(md));
      } catch (e) {
        setError(`Failed to load post: ${e instanceof Error ? e.message : e}`);
      }
    })();
  }, [slug]);

  if (error) {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-20 text-center">
        <Card>
          <CardContent className="p-8">
            <h1 className="text-2xl font-bold mb-2">Post not found</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Link href="/blog">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to blog
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!post || !html) {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-20">
        <Card className="animate-pulse">
          <CardContent className="p-8 h-96" />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${post.title} — STS Futures Blog`}
        description={post.excerpt}
        canonical={`https://stsdashboard.com/blog/${post.slug}`}
        ogImage={
          post.ogImage
            ? `https://stsdashboard.com${post.ogImage}`
            : undefined
        }
        ogType="article"
        keywords={post.keywords?.join(", ")}
      />
      <SEOStructured
        path={`/blog/${post.slug}`}
        title={post.title}
        description={post.excerpt}
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Blog", url: "/blog" },
          { name: post.title, url: `/blog/${post.slug}` },
        ]}
        article={{
          headline: post.title,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt || post.publishedAt,
          authorName: post.author,
          image: post.ogImage
            ? `https://stsdashboard.com${post.ogImage}`
            : undefined,
        }}
      />

      <main className="container max-w-3xl mx-auto px-4 py-12 md:py-16">
        <Link href="/blog">
          <Button variant="ghost" size="sm" className="mb-6 -ml-3">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to blog
          </Button>
        </Link>

        <article>
          <header className="mb-8 pb-8 border-b">
            {post.category && (
              <p className="text-xs font-semibold tracking-wide uppercase text-emerald-600 dark:text-emerald-400 mb-3">
                {post.category}
              </p>
            )}
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 leading-tight">
              {post.title}
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed mb-4">
              {post.excerpt}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <User className="w-4 h-4" />
                {post.author}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {formatDate(post.publishedAt)}
              </span>
              {post.readingMinutes && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {post.readingMinutes} min read
                </span>
              )}
            </div>
          </header>

          <div
            className="prose prose-lg dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </article>

        {related.length > 0 && (
          <aside className="mt-16 pt-8 border-t">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Keep reading
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {related.map(r => (
                <Link key={r.slug} href={`/blog/${r.slug}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardContent className="p-4">
                      {r.category && (
                        <p className="text-[10px] font-semibold tracking-wide uppercase text-emerald-600 dark:text-emerald-400 mb-1.5">
                          {r.category}
                        </p>
                      )}
                      <h3 className="font-semibold text-sm mb-1.5 line-clamp-2">
                        {r.title}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {r.excerpt}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </aside>
        )}

        <div className="mt-16 pt-8 border-t">
          <Card className="bg-gradient-to-br from-emerald-600 to-cyan-700 text-white border-0">
            <CardContent className="p-8 text-center">
              <h3 className="text-2xl font-bold mb-2">
                Ready to trade the signals?
              </h3>
              <p className="opacity-90 mb-6">
                $50/month · Cancel anytime · 15-day money-back guarantee
              </p>
              <Link href="/pricing">
                <Button className="bg-white text-emerald-700 hover:bg-emerald-50">
                  See pricing
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
