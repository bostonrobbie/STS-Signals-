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
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
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
