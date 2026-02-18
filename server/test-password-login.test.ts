import { describe, it, expect } from "vitest";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, hashPassword } from "./auth/password";

describe("Password Login Fix Verification", () => {
  it("should verify admin account has correct password hash", async () => {
    const db = await getDb();

    const adminUser = await db
      .select()
      .from(users)
      .where(eq(users.email, "rgorham369@gmail.com"))
      .limit(1);

    expect(adminUser.length).toBeGreaterThan(0);
    expect(adminUser[0].passwordHash).toBeDefined();
    expect(adminUser[0].passwordHash).not.toBeNull();
    expect(adminUser[0].loginMethod).toBe("password");
  });

  it("should verify password hash can be verified", async () => {
    const db = await getDb();

    const adminUser = await db
      .select()
      .from(users)
      .where(eq(users.email, "rgorham369@gmail.com"))
      .limit(1);

    if (adminUser[0].passwordHash) {
      const isValid = await verifyPassword(
        "robbie99",
        adminUser[0].passwordHash
      );
      expect(isValid).toBe(true);
    }
  });

  it("should reject invalid password", async () => {
    const db = await getDb();

    const adminUser = await db
      .select()
      .from(users)
      .where(eq(users.email, "rgorham369@gmail.com"))
      .limit(1);

    if (adminUser[0].passwordHash) {
      const isValid = await verifyPassword(
        "wrongpassword",
        adminUser[0].passwordHash
      );
      expect(isValid).toBe(false);
    }
  });

  it("should handle password hashing correctly", async () => {
    const password = "TestPassword123";
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash.length).toBeGreaterThan(0);

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword("WrongPassword", hash);
    expect(isInvalid).toBe(false);
  });
});
