import { router } from "../_core/trpc";
import { billingRouter } from "./billing";
import { adminRoutes } from "./adminRoutes";
import { publicApi } from "./public";
import { portfolio } from "./portfolio";
import { strategies } from "./strategies";
import { trades } from "./trades";
import { platform } from "./platform";
import { userPreferencesRouter } from "./userPreferences";

export const appRouter = router({
  billing: billingRouter,
  admin: adminRoutes,
  publicApi,
  portfolio,
  strategies,
  trades,
  platform,
  userPreferences: userPreferencesRouter,
});

export type AppRouter = typeof appRouter;
