import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "./lib/trpc";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./lib/registerSW";

// Track connection state
let isConnected = true;
function getConnectionState() {
  return isConnected;
}

// Enhanced fetch with retry logic and better error handling
async function resilientFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(input, init);

      // Network error or server error
      if (!response.ok && response.status >= 500) {
        if (attempt < maxRetries) {
          // Exponential backoff: 100ms, 200ms
          await new Promise(resolve =>
            setTimeout(resolve, Math.pow(2, attempt) * 100)
          );
          continue;
        }
      }

      isConnected = true;
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      isConnected = false;

      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, attempt) * 100)
        );
      }
    }
  }

  isConnected = false;
  throw (
    lastError ||
    new Error("Failed to fetch after retries - possible network issue")
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on 401 Unauthorized
        if (error?.data?.code === "UNAUTHORIZED") {
          return false;
        }
        // Retry up to 2 times for other errors
        return failureCount < 2;
      },
      // Default 5-minute stale window. Most queries on the dashboard
      // are slow-moving (trade history, strategy metadata, equity
      // curves over months/years). Per-query overrides can shorten
      // this for endpoints that need fresher data (admin telemetry,
      // status panels, signal log) and lengthen it for static data.
      staleTime: 5 * 60 * 1000,
      // Garbage-collect cached results 30 minutes after the last
      // observer unmounts. Was 10 min — bumping to 30 means a
      // dashboard tab the user briefly switches away from doesn't
      // re-fetch on return.
      gcTime: 30 * 60 * 1000,
      // Don't refetch on window focus by default. The data is rarely
      // stale enough in a 5-minute window for the refetch cost (network
      // + render) to be worth it. Endpoints that DO need fresh-on-focus
      // (Status, SafetyPanel) can opt in with refetchOnWindowFocus: true.
      refetchOnWindowFocus: false,
      // Keep network-tab quiet on reconnect — the periodic
      // invalidateQueries() below handles stale data on reconnect.
      refetchOnReconnect: "always",
    },
    mutations: {
      // Mutations don't auto-retry — a dropped POST mid-flight could
      // fire the same notification twice. Caller decides retry strategy.
      retry: false,
    },
  },
});

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch: resilientFetch,
      // @ts-expect-error TS2353
      credentials: "include",
      // Session cookies are automatically sent by the browser
      // Batch requests for efficiency but with reasonable limits
      maxURLLength: 2000,
    }),
  ],
});

// Periodic connection check to proactively detect issues
setInterval(() => {
  if (!getConnectionState()) {
    // If we think we're offline, invalidate stale queries when we come back
    queryClient.invalidateQueries({ stale: true });
  }
}, 60000);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  </React.StrictMode>
);

// Register service worker for caching and offline support
registerServiceWorker();
