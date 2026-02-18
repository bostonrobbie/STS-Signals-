export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  ownerEmail: process.env.OWNER_EMAIL ?? "rgorham369@gmail.com",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Email configuration
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  EMAIL_FROM:
    process.env.EMAIL_FROM ??
    "IntraDay Strategies <noreply@intradaystrategies.com>",
  VITE_APP_URL: process.env.VITE_APP_URL ?? "",
  // Webhook authentication
  TRADINGVIEW_WEBHOOK_TOKEN: process.env.TRADINGVIEW_WEBHOOK_TOKEN ?? "",
};
