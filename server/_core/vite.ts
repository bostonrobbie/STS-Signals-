import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer, type ViteDevServer } from "vite";
import viteConfig from "../../vite.config";

let viteServer: ViteDevServer | null = null;

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: {
      server,
      // Increase timeout for proxy environments
      timeout: 30000,
    },
    allowedHosts: true as const,
  };

  try {
    viteServer = await createViteServer({
      ...viteConfig,
      configFile: false,
      server: serverOptions,
      appType: "custom",
    });

    // Log HMR connection status
    viteServer.ws.on("connection", () => {
      console.log("[Vite HMR] Client connected");
    });

    viteServer.ws.on("error", err => {
      console.warn(
        "[Vite HMR] WebSocket error (non-fatal in proxy environments):",
        err.message
      );
    });

    app.use(viteServer.middlewares);

    // Handle Vite HMR errors gracefully
    app.use(
      (
        err: Error,
        _req: express.Request,
        _res: express.Response,
        next: express.NextFunction
      ) => {
        if (
          err.message?.includes("websocket") ||
          err.message?.includes("HMR")
        ) {
          console.warn(
            "[Vite HMR] Connection issue (expected in proxy environments)"
          );
          return next();
        }
        next(err);
      }
    );

    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;

      try {
        const clientTemplate = path.resolve(
          import.meta.dirname,
          "../..",
          "client",
          "index.html"
        );

        // always reload the index.html file from disk incase it changes
        let template = await fs.promises.readFile(clientTemplate, "utf-8");
        template = template.replace(
          `src="/src/main.tsx"`,
          `src="/src/main.tsx?v=${nanoid()}"`
        );

        if (viteServer) {
          const page = await viteServer.transformIndexHtml(url, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(page);
        } else {
          // Fallback if Vite server is not available
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        }
      } catch (e) {
        if (viteServer) {
          viteServer.ssrFixStacktrace(e as Error);
        }
        next(e);
      }
    });

    console.log("[Vite] Development server initialized successfully");
  } catch (error) {
    console.error("[Vite] Failed to initialize development server:", error);
    throw error;
  }
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Static asset caching strategy:
  //
  //   - Hashed bundles (foo.{8+ hex}.js / .css / .woff2) → 1 year + immutable.
  //     The hash in the filename guarantees a new URL on rebuild, so the
  //     old URL is genuinely immutable for the lifetime of that filename.
  //
  //   - Images (png/jpg/webp/avif/gif/svg/ico) → 1 day + SWR for a week.
  //     Long enough to dominate repeat-visit speed, short enough that
  //     re-uploads (e.g. logo refresh) propagate within a reasonable
  //     window without manual cache-busting.
  //
  //   - Crawler / text files (txt/xml/json/.well-known/*) → 1 hour + SWR
  //     for a day. Robots, sitemap, llms.txt, manifest, ai.txt, security.txt,
  //     humans.txt — search engines re-fetch these often; we want updates
  //     to land within an hour but tolerate a day of stale.
  //
  //   - Everything else (HTML, etc.) → no Cache-Control set; falls through
  //     to express.static defaults (Last-Modified-based revalidation),
  //     which is correct for index.html that we rebuild every deploy.
  //
  // Note: Cloudflare sits in front of Manus and may override these per
  // its own cache rules. Setting them here is correct fallback behavior
  // when Express is hit directly (e.g. on a self-hosted deploy).
  app.use(
    express.static(distPath, {
      setHeaders: (res, filePath) => {
        // Hashed bundle: never changes for this URL.
        if (/\.[a-f0-9]{8,}\.(js|css|woff2?|map)$/.test(filePath)) {
          res.setHeader(
            "Cache-Control",
            "public, max-age=31536000, immutable"
          );
          return;
        }
        // Images: long but not forever (filenames may not be hashed).
        if (/\.(png|jpe?g|webp|avif|gif|svg|ico)$/i.test(filePath)) {
          res.setHeader(
            "Cache-Control",
            "public, max-age=86400, stale-while-revalidate=604800"
          );
          return;
        }
        // Crawler/text files (and .well-known/*).
        if (
          /\.(txt|xml|json)$/.test(filePath) ||
          filePath.includes(`${path.sep}.well-known${path.sep}`)
        ) {
          res.setHeader(
            "Cache-Control",
            "public, max-age=3600, stale-while-revalidate=86400"
          );
          return;
        }
      },
    })
  );

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

// Graceful shutdown handler for Vite
export async function closeVite() {
  if (viteServer) {
    await viteServer.close();
    viteServer = null;
    console.log("[Vite] Development server closed");
  }
}
