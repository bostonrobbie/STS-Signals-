import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export const userPreferencesRouter = router({
  // Get user preferences
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    const user = await db
      .select({
        accountSize: users.accountSize,
        riskPercentage: users.riskPercentage,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (!user || user.length === 0) {
      return {
        accountSize: null,
        riskPercentage: "1.00",
      };
    }

    return {
      accountSize: user[0].accountSize,
      riskPercentage: user[0].riskPercentage || "1.00",
    };
  }),

  // Update user preferences
  updatePreferences: protectedProcedure
    .input(
      z.object({
        accountSize: z.number().positive().optional(),
        riskPercentage: z.number().min(0.1).max(10).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      const updateData: any = {};
      if (input.accountSize !== undefined) {
        updateData.accountSize = input.accountSize.toString();
      }
      if (input.riskPercentage !== undefined) {
        updateData.riskPercentage = input.riskPercentage.toString();
      }

      await db.update(users).set(updateData).where(eq(users.id, ctx.user.id));

      return {
        success: true,
        message: "Preferences updated successfully",
      };
    }),
});
