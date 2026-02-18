// @ts-expect-error TS6133 unused
import { AXIOS_TIMEOUT_MS, COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import axios, { type AxiosInstance } from "axios";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
// @ts-expect-error TS6133 unused
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import type {
  ExchangeTokenRequest,
  ExchangeTokenResponse,
  GetUserInfoResponse,
  GetUserInfoWithJwtRequest,
  GetUserInfoWithJwtResponse,
} from "./types/manusTypes";
// Utility function
// @ts-expect-error TS6133 unused
const _isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

const EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
const GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
const GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;

class OAuthService {
  constructor(private client: ReturnType<typeof axios.create>) {
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }

  private decodeState(state: string): string {
    const redirectUri = atob(state);
    return redirectUri;
  }

  async getTokenByCode(
    code: string,
    state: string
  ): Promise<ExchangeTokenResponse> {
    const payload: ExchangeTokenRequest = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state),
    };

    const { data } = await this.client.post<ExchangeTokenResponse>(
      EXCHANGE_TOKEN_PATH,
      payload
    );

    return data;
  }

  async getUserInfoByToken(
    token: ExchangeTokenResponse
  ): Promise<GetUserInfoResponse> {
    const { data } = await this.client.post<GetUserInfoResponse>(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken,
      }
    );

    return data;
  }
}

const createOAuthHttpClient = (): AxiosInstance =>
  axios.create({
    baseURL: ENV.oAuthServerUrl,
    timeout: AXIOS_TIMEOUT_MS,
  });

class SDKServer {
  private readonly client: AxiosInstance;
  private readonly oauthService: OAuthService;

  constructor(client: AxiosInstance = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }

  private deriveLoginMethod(
    platforms: unknown,
    fallback: string | null | undefined
  ): string | null {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set<string>(
      platforms.filter((p): p is string => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (
      set.has("REGISTERED_PLATFORM_MICROSOFT") ||
      set.has("REGISTERED_PLATFORM_AZURE")
    )
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }

  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(
    code: string,
    state: string
  ): Promise<ExchangeTokenResponse> {
    return this.oauthService.getTokenByCode(code, state);
  }

  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken: string): Promise<GetUserInfoResponse> {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken,
    } as ExchangeTokenResponse);
    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetUserInfoResponse;
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }

  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async getUserInfoWithJwt(
    jwtToken: string
  ): Promise<GetUserInfoWithJwtResponse> {
    const payload: GetUserInfoWithJwtRequest = {
      jwtToken,
      projectId: ENV.appId,
    };

    const { data } = await this.client.post<GetUserInfoWithJwtResponse>(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );

    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetUserInfoWithJwtResponse;
  }

  async authenticateRequest(req: Request): Promise<User> {
    // Get session ID from cookie (check both session_id and app_session_id)
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionId = cookies.get("session_id") || cookies.get("app_session_id");

    if (!sessionId) {
      console.log("[Auth] MARKER_NEW_CODE_V2_RUNNING");
      console.log("[Auth] No session cookie found");
      throw ForbiddenError("No session");
    }

    // If using app_session_id (Manus OAuth), verify JWT
    if (sessionId === cookies.get("app_session_id")) {
      try {
        const decoded = await this.verifyJWT(sessionId);
        console.log("[Auth] OAuth session valid for:", decoded);

        // Try to find or create user from OAuth data
        const openId = decoded.openId || decoded.sub || "oauth_" + decoded.aud;
        const user = await db.getUserByOpenId(openId);

        if (user) {
          return user;
        }

        // Create user if doesn't exist
        await db.upsertUser({
          email: decoded.email || "",
          name: decoded.name || "User",
          openId,
          loginMethod: "oauth",
          // @ts-expect-error TS2322
          lastSignedIn: new Date(),
        });

        const newUser = await db.getUserByOpenId(openId);
        if (newUser) {
          return newUser;
        }

        throw ForbiddenError("User not found");
      } catch (error) {
        console.error("[Auth] OAuth session verification failed:", error);
        throw ForbiddenError("Invalid OAuth session");
      }
    }

    // Otherwise verify simple session
    try {
      const { sessions } = await import("../auth.simple");
      const sessionData = sessions.get(sessionId);

      if (sessionData && sessionData.expiresAt >= Date.now()) {
        console.log("[Auth] Session valid for user:", sessionData.userId);

        // Fetch user from database
        const user = await db.getUserById(sessionData.userId);
        if (!user) {
          throw ForbiddenError("User not found");
        }

        return user;
      }

      // Session not in memory - check database for remember token
      console.log(
        "[Auth] Session not in memory, checking database for remember token"
      );
      const user = await db.getUserByRememberToken(sessionId);

      if (user) {
        console.log("[Auth] Found user via remember token:", user.id);

        // Re-add to in-memory sessions for faster future lookups
        const expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000; // 1 year
        sessions.set(sessionId, {
          userId: user.id,
          email: user.email || "",
          expiresAt,
        });

        return user;
      }

      console.log("[Auth] Session expired or not found");
      throw ForbiddenError("Session expired");
    } catch (error) {
      console.error("[Auth] Session verification failed:", error);
      throw ForbiddenError("Invalid session");
    }
  }

  private async verifyJWT(token: string): Promise<any> {
    try {
      // Simple JWT verification without external library
      const parts = token.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT format");

      // Decode payload (second part)
      const payload = JSON.parse(
        Buffer.from(parts[1], "base64").toString("utf8")
      );

      // Check expiration
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        throw new Error("Token expired");
      }

      return payload;
    } catch (error) {
      throw new Error("JWT verification failed: " + String(error));
    }
  }
}

export const sdk = new SDKServer();
