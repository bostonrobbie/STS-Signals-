import { Router, Request, Response } from "express";
import * as db from "./db";
// @ts-expect-error TS6133 unused
import { ENV } from "./_core/env";

const router = Router();

// Session store (in production, use database or Redis)
const sessions = new Map<
  string,
  { userId: number; email: string; expiresAt: number }
>();

// Simple email-based login endpoint
// @ts-expect-error TS7030
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Create or get user
    const openId = `email_${email}`;
    await db.upsertUser({
      email,
      name: email.split("@")[0],
      openId,
      loginMethod: "email",
      // @ts-expect-error TS2322
      lastSignedIn: new Date(),
    });

    // Fetch the user after upsert
    const user = await db.getUserByOpenId(openId);

    if (!user || !user.id) {
      console.error(
        "[Auth] Failed to fetch user after upsert for email:",
        email
      );
      return res.status(500).json({ error: "Failed to create user" });
    }

    // Create session ID
    const sessionId =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    const expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000; // 1 year
    sessions.set(sessionId, {
      userId: user.id,
      email: user.email || email,
      expiresAt,
    });

    console.log(
      "[Auth] Login successful for email:",
      email,
      "User ID:",
      user.id,
      "Session:",
      sessionId
    );

    // Set session cookie
    res.cookie("session_id", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      path: "/",
    });

    // Return user info
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("[Auth] Login failed", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Logout endpoint
router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("session_id", { path: "/" });
  res.json({ success: true });
});

// Export sessions for use in context
export { sessions };
export default router;
