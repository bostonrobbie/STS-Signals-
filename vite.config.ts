import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

import path from "path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
import { suppressHMRWarnings } from "./vite-plugin-suppress-hmr-warnings";

const plugins = [
  react(),
  tailwindcss(),
  jsxLocPlugin(),
  vitePluginManusRuntime(),
  suppressHMRWarnings(), // Suppress HMR WebSocket warnings in proxied environment
];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Performance optimizations
    rollupOptions: {
      output: {
        // Manual chunking for better code splitting
        manualChunks: {
          // Vendor chunks
          "react-vendor": ["react", "react-dom", "react/jsx-runtime"],
          router: ["wouter"],
          ui: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
          ],
          charts: ["recharts"],
          trpc: ["@trpc/client", "@trpc/react-query", "@tanstack/react-query"],
          utils: ["date-fns", "clsx", "tailwind-merge"],
        },
      },
    },
    // Minification and compression
    minify: "esbuild", // Use esbuild for faster minification
    // Source maps for debugging (disable in production for smaller bundle)
    sourcemap: false,
    // Chunk size warnings
    chunkSizeWarningLimit: 1000,
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      ".us2.manus.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    // Enhanced HMR configuration for proxy environments
    hmr: {
      // Use WebSocket protocol that works through proxies
      protocol: "wss",
      // Use the same host as the page (fixes WebSocket connection in Manus environment)
      clientPort: 443,
      // Disable client-side overlay for connection errors (suppresses warnings)
      overlay: false,
      // Increase timeout for slower connections
      timeout: 30000,
    },
    // Watch configuration for better file change detection
    watch: {
      usePolling: false,
      interval: 100,
    },
  },
});
