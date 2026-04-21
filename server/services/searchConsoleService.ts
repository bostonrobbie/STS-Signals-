/**
 * Google Search Console (Search Analytics API) client.
 *
 * Pulls top queries / pages / overall summary for the configured site,
 * so the admin dashboard can show "what people are searching for when
 * they find STS Futures."
 *
 * No dependency on the `googleapis` SDK — uses direct fetch() calls
 * against the OAuth token + Search Analytics endpoints. Keeps the
 * bundle small and the auth flow easy to reason about.
 *
 * Activation (one-time):
 *   1. In Google Cloud Console, create OAuth 2.0 client credentials
 *      (Desktop app type is easiest).
 *   2. Use Google's OAuth Playground (or a one-off script) to do the
 *      OAuth handshake against the scope:
 *        https://www.googleapis.com/auth/webmasters.readonly
 *      and exchange the auth code for a refresh token.
 *   3. Set on Manus environment:
 *        GSC_CLIENT_ID
 *        GSC_CLIENT_SECRET
 *        GSC_REFRESH_TOKEN
 *        GSC_SITE_URL  (e.g. "https://stsdashboard.com/" — trailing slash)
 *   4. Restart. The admin dashboard's Search Console tab will populate.
 *
 * Without those env vars, every endpoint here returns a "not configured"
 * response — never throws, never blocks anything else.
 */

interface GSCConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  siteUrl: string;
}

function readConfig(): GSCConfig | null {
  const clientId = process.env.GSC_CLIENT_ID?.trim();
  const clientSecret = process.env.GSC_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GSC_REFRESH_TOKEN?.trim();
  const siteUrl = process.env.GSC_SITE_URL?.trim();
  if (!clientId || !clientSecret || !refreshToken || !siteUrl) return null;
  return { clientId, clientSecret, refreshToken, siteUrl };
}

export function isSearchConsoleConfigured(): boolean {
  return readConfig() !== null;
}

/**
 * Cached short-lived access token. Google access tokens last 1 hour;
 * we cache for 50 min to leave a safety margin.
 */
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(cfg: GSCConfig): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        refresh_token: cfg.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        "[SearchConsole] Token refresh failed:",
        res.status,
        text.slice(0, 200)
      );
      return null;
    }
    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    cachedToken = {
      token: data.access_token,
      expiresAt: now + 50 * 60_000, // 50 min
    };
    return data.access_token;
  } catch (err) {
    console.warn("[SearchConsole] Token refresh error:", err);
    return null;
  }
}

/**
 * Reset cached token — for tests or after credential rotation.
 */
export function _resetSearchConsoleTokenCache() {
  cachedToken = null;
}

interface GSCQueryRequest {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  dimensions?: ("query" | "page" | "device" | "country" | "date")[];
  rowLimit?: number;
  startRow?: number;
}

interface GSCRow {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GSCResponse {
  rows?: GSCRow[];
  responseAggregationType?: string;
}

async function querySearchAnalytics(
  cfg: GSCConfig,
  body: GSCQueryRequest
): Promise<GSCResponse | null> {
  const token = await getAccessToken(cfg);
  if (!token) return null;
  try {
    const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
      cfg.siteUrl
    )}/searchAnalytics/query`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        "[SearchConsole] Query failed:",
        res.status,
        text.slice(0, 300)
      );
      return null;
    }
    return (await res.json()) as GSCResponse;
  } catch (err) {
    console.warn("[SearchConsole] Query error:", err);
    return null;
  }
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultDateRange(daysBack: number): { startDate: string; endDate: string } {
  const end = new Date();
  // GSC data has a ~2 day lag — request through "today minus 2"
  end.setUTCDate(end.getUTCDate() - 2);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - daysBack + 1);
  return { startDate: formatDate(start), endDate: formatDate(end) };
}

export interface QueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number; // 0..1
  position: number;
}

export interface PageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SummaryStats {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  windowDays: number;
  startDate: string;
  endDate: string;
}

export interface SearchConsoleEnvelope<T> {
  configured: boolean;
  data: T | null;
  error?: string;
}

/**
 * Top search queries that returned this site as a result.
 */
export async function getTopQueries(
  daysBack: number = 28,
  limit: number = 25
): Promise<SearchConsoleEnvelope<QueryRow[]>> {
  const cfg = readConfig();
  if (!cfg) return { configured: false, data: null };
  const range = defaultDateRange(daysBack);
  const resp = await querySearchAnalytics(cfg, {
    ...range,
    dimensions: ["query"],
    rowLimit: limit,
  });
  if (!resp) {
    return {
      configured: true,
      data: null,
      error: "Search Console API call failed — see server logs.",
    };
  }
  const data: QueryRow[] = (resp.rows ?? []).map(r => ({
    query: r.keys?.[0] ?? "",
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
  return { configured: true, data };
}

/**
 * Top pages on the site by clicks.
 */
export async function getTopPages(
  daysBack: number = 28,
  limit: number = 25
): Promise<SearchConsoleEnvelope<PageRow[]>> {
  const cfg = readConfig();
  if (!cfg) return { configured: false, data: null };
  const range = defaultDateRange(daysBack);
  const resp = await querySearchAnalytics(cfg, {
    ...range,
    dimensions: ["page"],
    rowLimit: limit,
  });
  if (!resp) {
    return {
      configured: true,
      data: null,
      error: "Search Console API call failed — see server logs.",
    };
  }
  const data: PageRow[] = (resp.rows ?? []).map(r => ({
    page: r.keys?.[0] ?? "",
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
  return { configured: true, data };
}

/**
 * Site-wide totals for the window.
 */
export async function getSummary(
  daysBack: number = 28
): Promise<SearchConsoleEnvelope<SummaryStats>> {
  const cfg = readConfig();
  if (!cfg) return { configured: false, data: null };
  const range = defaultDateRange(daysBack);
  const resp = await querySearchAnalytics(cfg, {
    ...range,
    // No dimensions = aggregated totals
    rowLimit: 1,
  });
  if (!resp) {
    return {
      configured: true,
      data: null,
      error: "Search Console API call failed — see server logs.",
    };
  }
  const row = resp.rows?.[0];
  if (!row) {
    return {
      configured: true,
      data: {
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
        windowDays: daysBack,
        startDate: range.startDate,
        endDate: range.endDate,
      },
    };
  }
  return {
    configured: true,
    data: {
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      windowDays: daysBack,
      startDate: range.startDate,
      endDate: range.endDate,
    },
  };
}
