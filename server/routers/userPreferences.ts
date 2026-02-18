import { z } from "zod";
// @ts-expect-error TS2305
import { db } from "../db";
import { userPreferences } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";

export const userPreferencesRouter = router({
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    // Try to get existing preferences
    const existing = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    // If no preferences exist, create default ones
    const [newPrefs] = await db
      .insert(userPreferences)
      .values({
        userId,
        contractSize: "mini",
        accountValue: 100000,
        theme: "light",
        timezone: "America/New_York",
      })
      .$returningId();

    // Fetch and return the newly created preferences
    const [created] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.id, newPrefs.id))
      .limit(1);

    return created;
  }),

  updatePreferences: protectedProcedure
    .input(
      z.object({
        contractSize: z.enum(["mini", "micro"]).optional(),
        accountValue: z.number().int().positive().optional(),
        theme: z.enum(["light", "dark"]).optional(),
        timezone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Check if preferences exist
      const existing = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      if (existing.length === 0) {
        // Create new preferences with provided values
        const [newPrefs] = await db
          .insert(userPreferences)
          .values({
            userId,
            contractSize: input.contractSize || "mini",
            accountValue: input.accountValue || 100000,
            theme: input.theme || "light",
            timezone: input.timezone || "America/New_York",
          })
          .$returningId();

        const [created] = await db
          .select()
          .from(userPreferences)
          .where(eq(userPreferences.id, newPrefs.id))
          .limit(1);

        return created;
      }

      // Update existing preferences
      await db
        .update(userPreferences)
        .set({
          ...input,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(userPreferences.userId, userId));

      // Fetch and return updated preferences
      const [updated] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      return updated;
    }),
});
