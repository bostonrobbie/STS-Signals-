#!/usr/bin/env node

import { getDb } from "../db.ts";
import { users } from "../../drizzle/schema.ts";
import { eq } from "drizzle-orm";

async function createAdminUser() {
  try {
    const db = await getDb();
    if (!db) {
      console.error("❌ Database connection failed");
      process.exit(1);
    }

    // Check if admin already exists
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.email, "admin@intradaydash.com"));

    if (existingAdmin.length > 0) {
      console.log("✅ Admin user already exists");
      console.log("   Email: admin@intradaydash.com");
      console.log("   Password: AdminPassword123!");
      process.exit(0);
    }

    // Create admin user with bcrypt hashed password
    const result = await db.insert(users).values({
      email: "admin@intradaydash.com",
      passwordHash: "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm",
      name: "Admin",
      role: "admin",
      loginMethod: "password",
      subscriptionTier: "premium",
      onboardingCompleted: 1,
    });

    console.log("✅ Admin user created successfully!");
    console.log("   Email: admin@intradaydash.com");
    console.log("   Password: AdminPassword123!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
    process.exit(1);
  }
}

createAdminUser();
