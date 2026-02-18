import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    // CRITICAL: Set NODE_ENV=test to ensure all database writes are marked as test data
    env: {
      NODE_ENV: "test",
      VITEST: "true",
    },
    // Global setup to ensure test isolation
    globalSetup: [],
  },
});
