/**
 * RSS feed for the blog at /blog/rss.xml.
 *
 * Reads the static blog manifest at client/public/blog/manifest.json and
 * emits an RSS 2.0 feed. Useful for:
 *   - traditional feed readers (still exist)
 *   - aggregators like Feedly
 *   - some AI crawlers that prefer RSS over sitemap for content discovery
 *   - social-media auto-posting tools
 *
 * Cached 1 hour client-side. Updates on next deploy when manifest.json changes.
 */
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";

export const rssRouter = Router();

interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: string;
  updatedAt?: string;
  category?: string;
  tags?: string[];
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function resolveManifestPath(): string {
  // Dev: client/public/blog/manifest.json
  // Prod (after Vite build): dist/public/blog/manifest.json
  const dev = path.resolve(
    import.meta.dirname,
    "..",
    "client",
    "public",
    "blog",
    "manifest.json"
  );
  if (fs.existsSync(dev)) return dev;
  const prod = path.resolve(
    import.meta.dirname,
    "public",
    "blog",
    "manifest.json"
  );
  return prod;
}

rssRouter.get("/blog/rss.xml", (_req, res) => {
  try {
    const file = resolveManifestPath();
    if (!fs.existsSync(file)) {
      res.status(404).type("text/plain").send("RSS manifest missing");
      return;
    }
    const manifest = JSON.parse(fs.readFileSync(file, "utf-8")) as {
      posts: BlogPost[];
    };
    const posts = [...(manifest.posts || [])].sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() -
        new Date(a.publishedAt).getTime()
    );

    const now = new Date().toUTCString();
    const items = posts
      .map(p => {
        const pubDate = new Date(p.publishedAt).toUTCString();
        const url = `https://stsdashboard.com/blog/${p.slug}`;
        return `
    <item>
      <title>${xmlEscape(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <author>noreply@stsdashboard.com (${xmlEscape(p.author)})</author>
      ${p.category ? `<category>${xmlEscape(p.category)}</category>` : ""}
      <description>${xmlEscape(p.excerpt)}</description>
    </item>`;
      })
      .join("");

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>STS Futures — NQ Trading Blog</title>
    <link>https://stsdashboard.com/blog</link>
    <atom:link href="https://stsdashboard.com/blog/rss.xml" rel="self" type="application/rss+xml"/>
    <description>Weekly NQ market recaps, systematic trading strategy deep-dives, and backtest methodology from Rob Gorham, founder of STS Futures.</description>
    <language>en-US</language>
    <copyright>© STS Futures. All rights reserved.</copyright>
    <lastBuildDate>${now}</lastBuildDate>
    <ttl>60</ttl>
    <image>
      <url>https://stsdashboard.com/favicon.svg</url>
      <title>STS Futures</title>
      <link>https://stsdashboard.com</link>
    </image>${items}
  </channel>
</rss>`;

    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(rss);
  } catch (err) {
    console.error("[RSS] failed to serve feed:", err);
    res.status(500).type("text/plain").send("RSS feed error");
  }
});
