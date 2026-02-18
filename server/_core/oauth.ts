import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  // Explicitly handle /overview to prevent any route conflicts
  // This ensures /overview always serves the React app
  app.get("/overview", (_req: Request, _res: Response, next: Function) => {
    // Let the Vite/static handler serve the React app
    next();
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const returnTo = getQueryParam(req, "returnTo");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        // @ts-expect-error TS2322
        email: userInfo.email ?? null,
        // @ts-expect-error TS2322
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        // @ts-expect-error TS2322
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      console.log(
        "[OAuth] Setting session cookie with options:",
        cookieOptions
      );
      console.log("[OAuth] Session token length:", sessionToken.length);
      console.log(
        "[OAuth] Session token parts:",
        sessionToken.split(".").length
      );
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      // Redirect to the intended page or dashboard overview by default
      // Validate returnTo to prevent open redirect vulnerabilities
      let redirectUrl = "/overview";
      if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
        redirectUrl = returnTo;
      }

      console.log("[OAuth] Login successful, returning token");
      // Return HTML with token that frontend can extract and store
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Redirecting...</title>
            <script>
              const token = '${sessionToken}';
              localStorage.setItem('auth_token', token);
              window.location.href = '${redirectUrl}';
            </script>
          </head>
          <body>Redirecting...</body>
        </html>
      `;
      res.send(html);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
