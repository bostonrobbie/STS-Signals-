import { Router } from "express";
import fs from "fs";
import path from "path";

/**
 * SEO Routes - Explicitly serve curated robots.txt and sitemap.xml
 *
 * The Manus hosting infrastructure auto-generates these files, overriding
 * our curated static versions. By registering explicit Express routes early
 * in the middleware chain, we ensure our versions take priority.
 */
export const seoRouter = Router();

// Helper to resolve the correct path for static SEO files
function getSeoFilePath(filename: string): string {
  // In production, files are in the dist/public directory relative to the server
  // In development, they're in client/public
  if (process.env.NODE_ENV === "development") {
    return path.resolve(
      import.meta.dirname,
      "..",
      "client",
      "public",
      filename
    );
  }
  return path.resolve(import.meta.dirname, "public", filename);
}

// Serve curated robots.txt
seoRouter.get("/robots.txt", (_req, res) => {
  const filePath = getSeoFilePath("robots.txt");

  if (fs.existsSync(filePath)) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400"); // Cache for 24 hours
    res.sendFile(filePath);
  } else {
    // Fallback: inline robots.txt if file not found
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(
      `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nSitemap: https://stsdashboard.com/sitemap.xml\n`
    );
  }
});

// Serve curated sitemap.xml
seoRouter.get("/sitemap.xml", (_req, res) => {
  const filePath = getSeoFilePath("sitemap.xml");

  if (fs.existsSync(filePath)) {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400"); // Cache for 24 hours
    res.sendFile(filePath);
  } else {
    // Fallback: minimal sitemap if file not found
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://stsdashboard.com/</loc><priority>1.0</priority></url>
  <url><loc>https://stsdashboard.com/pricing</loc><priority>0.9</priority></url>
</urlset>`);
  }
});
