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

  app.use(express.static(distPath));

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
