/**
 * tRPC routes for the admin Search Console panel.
 *
 * All endpoints are read-only and admin-gated. Each returns an envelope
 * with `configured: false` when the GSC env vars aren't set, so the
 * client can render a "configure first" hint instead of an error.
 */

import { z } from "zod";
import { router, adminProcedure } from "../_core/trpc";
import {
  getSummary,
  getTopPages,
  getTopQueries,
  isSearchConsoleConfigured,
} from "../services/searchConsoleService";

const dateInput = z
  .object({
    daysBack: z.number().int().min(1).max(90).default(28),
    limit: z.number().int().min(1).max(100).default(25),
  })
  .optional()
  .default({ daysBack: 28, limit: 25 });

export const adminSearchConsoleRouter = router({
  /** Whether GSC env vars are present. Cheap, no API call. */
  status: adminProcedure.query(() => {
    return {
      success: true,
      data: { configured: isSearchConsoleConfigured() },
    };
  }),

  /** Aggregate clicks + impressions for the window. */
  summary: adminProcedure
    .input(z.object({ daysBack: z.number().min(1).max(90).default(28) }).optional())
    .query(async ({ input }) => {
      const days = input?.daysBack ?? 28;
      const result = await getSummary(days);
      return { success: true, data: result };
    }),

  /** Top search queries that returned this site. */
  topQueries: adminProcedure.input(dateInput).query(async ({ input }) => {
    const result = await getTopQueries(input.daysBack, input.limit);
    return { success: true, data: result };
  }),

  /** Top pages by click count. */
  topPages: adminProcedure.input(dateInput).query(async ({ input }) => {
    const result = await getTopPages(input.daysBack, input.limit);
    return { success: true, data: result };
  }),
});

export default adminSearchConsoleRouter;
