import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { ENV } from "../_core/env";
import {
  hashPassword,
  verifyPassword,
  // @ts-expect-error TS6133 unused
  generateRememberToken,
  // @ts-expect-error TS6133 unused
  getRememberTokenExpiry,
  validatePasswordStrength,
} from "./password";
import crypto from "crypto";

const SignupInput = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const LoginInput = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string(),
  rememberMe: z.boolean().optional().default(false),
});

export const passwordRouter = router({
  /**
   * Sign up with email and password
   */
  signup: publicProcedure.input(SignupInput).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    // Validate password strength
    const passwordValidation = validatePasswordStrength(input.password);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.errors.join("; "));
    }

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error("Email already registered");
    }

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Generate unique openId for password-based signup
    const openId = `pwd_${crypto.randomBytes(16).toString("hex")}`;

    // Check if this email should be admin (owner email)
    const isOwnerEmail = input.email === ENV.ownerEmail;

    // Create user
    const result = await db.insert(users).values({
      openId,
      email: input.email,
      name: input.name,
      passwordHash,
      loginMethod: "password",
      subscriptionTier: "free",
      subscriptionStatus: "active",
      onboardingCompleted: 0,
      onboardingDismissed: 0,
      startingCapital: 100000,
      contractSize: "micro",
      freeAlertsRemaining: 10,
      role: isOwnerEmail ? "admin" : "user",
    });

    // Handle insertId properly - it might be a BigInt or number
    const userId =
      // @ts-expect-error TS2339
      typeof result.insertId === "bigint"
        ? // @ts-expect-error TS2339
          Number(result.insertId)
        : // @ts-expect-error TS2339
          Number(result.insertId || result[0]?.insertId);

    if (isNaN(userId) || userId === 0) {
      throw new Error("Failed to create user - invalid ID returned");
    }

    // Fetch created user
    const newUser = await db
      .select()
      .from(users)
      .where(eq(users.id, Number(userId)))
      .limit(1);

    if (!newUser[0]) {
      throw new Error("Failed to create user");
    }

    return {
      success: true,
      user: {
        id: newUser[0].id,
        email: newUser[0].email,
        name: newUser[0].name,
        role: newUser[0].role,
        subscriptionTier: newUser[0].subscriptionTier,
      },
    };
  }),

  /**
   * Login with email and password
   */
  login: publicProcedure.input(LoginInput).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    // Find user by email
    const userList = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (userList.length === 0) {
      throw new Error("Invalid email or password");
    }

    const user = userList[0];

    // Verify password
    if (!user.passwordHash) {
      throw new Error(
        "This account uses OAuth login. Please use Google sign-in."
      );
    }

    const passwordValid = await verifyPassword(
      input.password,
      user.passwordHash
    );
    if (!passwordValid) {
      throw new Error("Invalid email or password");
    }

    // Check if this email should be admin (owner email) and update role if needed
    const isOwnerEmail = user.email === ENV.ownerEmail;
    const shouldBeAdmin = isOwnerEmail && user.role !== "admin";

    // Update last signed in and role if needed
    await db
      .update(users)
      .set({
        lastSignedIn: new Date().toISOString(),
        ...(shouldBeAdmin ? { role: "admin" } : {}),
      })
      .where(eq(users.id, user.id));

    // Update local user object if role changed
    if (shouldBeAdmin) {
      user.role = "admin";
    }

    // Create session for authenticated requests
    const { sessions } = await import("../auth.simple");
    const sessionId =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    const expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000; // 1 year
    sessions.set(sessionId, {
      userId: user.id,
      email: user.email || input.email,
      expiresAt,
    });

    // Always store session ID in database for persistence across server restarts
    const expiryDate = new Date(expiresAt);
    await db
      .update(users)
      .set({
        rememberToken: sessionId,
        rememberTokenExpiresAt: expiryDate.toISOString(),
      })
      .where(eq(users.id, user.id));

    // Set session cookie
    ctx.res.cookie("session_id", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      path: "/",
    });

    // Legacy rememberToken for backwards compatibility
    let rememberToken: string | undefined;
    if (input.rememberMe) {
      rememberToken = sessionId;
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionTier: user.subscriptionTier,
      },
      rememberToken,
    };
  }),

  /**
   * Verify remember token
   */
  verifyRememberToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { valid: false };
      const userList = await db
        .select()
        .from(users)
        .where(eq(users.rememberToken, input.token))
        .limit(1);

      if (userList.length === 0) {
        return { valid: false };
      }

      const user = userList[0];

      // Check if token is expired
      if (
        !user.rememberTokenExpiresAt ||
        new Date(user.rememberTokenExpiresAt) < new Date()
      ) {
        // Clear expired token
        await db
          .update(users)
          .set({ rememberToken: null, rememberTokenExpiresAt: null })
          .where(eq(users.id, user.id));

        return { valid: false };
      }

      return {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          subscriptionTier: user.subscriptionTier,
        },
      };
    }),

  /**
   * Logout (clear remember token)
   */
  logout: publicProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(users)
        .set({ rememberToken: null, rememberTokenExpiresAt: null })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  /**
   * Change password
   */
  changePassword: publicProcedure
    .input(
      z.object({
        userId: z.number(),
        currentPassword: z.string(),
        newPassword: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Validate new password strength
      const passwordValidation = validatePasswordStrength(input.newPassword);
      if (!passwordValidation.valid) {
        throw new Error(passwordValidation.errors.join("; "));
      }

      // Get user
      const userList = await db
        .select()
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (userList.length === 0) {
        throw new Error("User not found");
      }

      const user = userList[0];

      // Verify current password
      if (!user.passwordHash) {
        throw new Error("This account uses OAuth login");
      }

      const passwordValid = await verifyPassword(
        input.currentPassword,
        user.passwordHash
      );
      if (!passwordValid) {
        throw new Error("Current password is incorrect");
      }

      // Hash new password
      const newPasswordHash = await hashPassword(input.newPassword);

      // Update password
      await db
        .update(users)
        .set({ passwordHash: newPasswordHash })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),
  /**
   * Request password reset
   */
  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Find user by email
      const userList = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      // Always return success to prevent email enumeration
      if (userList.length === 0) {
        console.log(`[Password Reset] No user found for email: ${input.email}`);
        return {
          success: true,
          message: "If an account exists, a reset link has been sent.",
        };
      }

      const user = userList[0];

      // Check if user uses OAuth
      if (!user.passwordHash) {
        console.log(
          `[Password Reset] User ${input.email} uses OAuth, skipping reset`
        );
        return {
          success: true,
          message: "If an account exists, a reset link has been sent.",
        };
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store token in database
      await db
        .update(users)
        .set({
          passwordResetToken: resetToken,
          passwordResetExpires: resetTokenExpiry.toISOString(),
        })
        .where(eq(users.id, user.id));

      // In production, send email with reset link
      // For now, log the reset link
      // @ts-expect-error TS2339
      const resetUrl = `${ENV.frontendUrl || "https://stsdashboard.com"}/reset-password?token=${resetToken}`;
      console.log(
        `[Password Reset] Reset link for ${input.email}: ${resetUrl}`
      );

      // TODO: Send email using Resend or other email service
      // await sendPasswordResetEmail(user.email, resetUrl);

      return {
        success: true,
        message: "If an account exists, a reset link has been sent.",
      };
    }),

  /**
   * Reset password with token
   */
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string(),
        newPassword: z
          .string()
          .min(8, "Password must be at least 8 characters"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Validate password strength
      const passwordValidation = validatePasswordStrength(input.newPassword);
      if (!passwordValidation.valid) {
        throw new Error(passwordValidation.errors.join("; "));
      }

      // Find user by reset token
      const userList = await db
        .select()
        .from(users)
        .where(eq(users.passwordResetToken, input.token))
        .limit(1);

      if (userList.length === 0) {
        throw new Error(
          "Invalid or expired reset link. Please request a new one."
        );
      }

      const user = userList[0];

      // Check if token is expired
      if (
        !user.passwordResetExpires ||
        new Date(user.passwordResetExpires) < new Date()
      ) {
        // Clear expired token
        await db
          .update(users)
          .set({ passwordResetToken: null, passwordResetExpires: null })
          .where(eq(users.id, user.id));
        throw new Error("Reset link has expired. Please request a new one.");
      }

      // Hash new password
      const newPasswordHash = await hashPassword(input.newPassword);

      // Update password and clear reset token
      await db
        .update(users)
        .set({
          passwordHash: newPasswordHash,
          passwordResetToken: null,
          passwordResetExpires: null,
        })
        .where(eq(users.id, user.id));

      console.log(
        `[Password Reset] Password successfully reset for user: ${user.email}`
      );

      return {
        success: true,
        message: "Password has been reset successfully.",
      };
    }),

  /**
   * Get current user
   */
  me: publicProcedure
    .input(z.object({ userId: z.number().optional() }).optional())
    .query(async ({ input, ctx }) => {
      // Get userId from input, context user, or context userId
      const userId = input?.userId || ctx.user?.id || (ctx as any)?.userId;
      if (!userId) return { user: null };

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userList = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (userList.length === 0) return { user: null };

      const user = userList[0];
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          subscriptionTier: user.subscriptionTier,
        },
      };
    }),
});
