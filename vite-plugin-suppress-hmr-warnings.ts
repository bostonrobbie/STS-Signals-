import type { Plugin } from "vite";

/**
 * Vite plugin to suppress HMR WebSocket connection warnings in development
 * These warnings are expected in proxied environments like Manus
 */
export function suppressHMRWarnings(): Plugin {
  return {
    name: "suppress-hmr-warnings",
    apply: "serve",
    transformIndexHtml() {
      return [
        {
          tag: "script",
          injectTo: "head-prepend",
          children: `
            // Suppress Vite HMR WebSocket connection warnings
            (function() {
              const originalConsoleError = console.error;
              console.error = function(...args) {
                const message = args.join(' ');
                // Suppress HMR WebSocket connection errors
                if (
                  message.includes('[vite] failed to connect to websocket') ||
                  message.includes('WebSocket (failing)') ||
                  message.includes('server-hmr')
                ) {
                  return; // Suppress the warning
                }
                // Pass through all other errors
                originalConsoleError.apply(console, args);
              };
            })();
          `,
        },
      ];
    },
  };
}
