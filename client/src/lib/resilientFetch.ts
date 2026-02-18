/**
 * Resilient Fetch Wrapper
 *
 * Provides robust fetch functionality with:
 * - Automatic retry with exponential backoff
 * - Request timeout handling
 * - Connection state tracking
 * - Offline detection and recovery
 * - Request deduplication
 */

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  timeout: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  timeout: 30000, // 30 second timeout per request
};

// Connection state tracking
let isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
let connectionListenersInitialized = false;
const pendingRequests = new Map<string, Promise<Response>>();
const connectionStateListeners = new Set<(online: boolean) => void>();

/**
 * Initialize connection state listeners
 */
function initConnectionListeners() {
  if (connectionListenersInitialized || typeof window === "undefined") return;
  connectionListenersInitialized = true;

  window.addEventListener("online", () => {
    isOnline = true;
    console.log("[Network] Connection restored");
    connectionStateListeners.forEach(listener => listener(true));
  });

  window.addEventListener("offline", () => {
    isOnline = false;
    console.log("[Network] Connection lost");
    connectionStateListeners.forEach(listener => listener(false));
  });

  // Periodic connectivity check (every 30 seconds)
  setInterval(async () => {
    try {
      const response = await fetch("/api/live", {
        method: "HEAD",
        cache: "no-store",
      });
      const wasOffline = !isOnline;
      isOnline = response.ok;
      if (wasOffline && isOnline) {
        console.log("[Network] Connection verified");
        connectionStateListeners.forEach(listener => listener(true));
      }
    } catch {
      // Don't update state on failed check - could be temporary
    }
  }, 30000);
}

// Initialize on module load
initConnectionListeners();

/**
 * Subscribe to connection state changes
 */
export function onConnectionChange(
  listener: (online: boolean) => void
): () => void {
  connectionStateListeners.add(listener);
  return () => connectionStateListeners.delete(listener);
}

/**
 * Get current connection state
 */
export function getConnectionState(): boolean {
  return isOnline;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  return Math.min(exponentialDelay + jitter, config.maxDelay);
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof TypeError) {
    // Network errors (fetch failed)
    return true;
  }

  // Check for AbortError (timeout)
  if (
    error instanceof Error &&
    (error.name === "AbortError" || error.message.includes("abort"))
  ) {
    return true;
  }

  return false;
}

/**
 * Check if response status is retryable
 */
function isRetryableStatus(status: number): boolean {
  // Retry on server errors and rate limiting
  return status >= 500 || status === 429 || status === 408;
}

/**
 * Create a request key for deduplication
 */
function getRequestKey(input: RequestInfo | URL, init?: RequestInit): string {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const method = init?.method || "GET";
  return `${method}:${url}`;
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Resilient fetch with automatic retry and error recovery
 */
export async function resilientFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  config: Partial<RetryConfig> = {}
): Promise<Response> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const requestKey = getRequestKey(input, init);

  // Check for pending identical request (deduplication)
  const pendingRequest = pendingRequests.get(requestKey);
  if (pendingRequest && init?.method === "GET") {
    return pendingRequest;
  }

  // Wait for connection if offline
  if (!isOnline) {
    console.log("[Fetch] Waiting for connection...");
    await waitForConnection(finalConfig.timeout);
  }

  const executeRequest = async (): Promise<Response> => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        const response = await fetchWithTimeout(
          input,
          init,
          finalConfig.timeout
        );

        // Check if response indicates we should retry
        if (
          isRetryableStatus(response.status) &&
          attempt < finalConfig.maxRetries
        ) {
          const delay = calculateDelay(attempt, finalConfig);
          console.log(
            `[Fetch] Retrying after ${response.status} (attempt ${attempt + 1}/${finalConfig.maxRetries}, delay: ${Math.round(delay)}ms)`
          );
          await sleep(delay);
          continue;
        }

        return response;
      } catch (error) {
        lastError = error;

        // Check if we should retry
        if (isRetryableError(error) && attempt < finalConfig.maxRetries) {
          const delay = calculateDelay(attempt, finalConfig);
          console.log(
            `[Fetch] Retrying after error (attempt ${attempt + 1}/${finalConfig.maxRetries}, delay: ${Math.round(delay)}ms)`
          );
          await sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  };

  // Store promise for deduplication (only for GET requests)
  if (init?.method === "GET" || !init?.method) {
    const promise = executeRequest();
    pendingRequests.set(requestKey, promise);

    try {
      const response = await promise;
      return response;
    } finally {
      pendingRequests.delete(requestKey);
    }
  }

  return executeRequest();
}

/**
 * Wait for connection to be restored
 */
function waitForConnection(timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isOnline) {
      resolve();
      return;
    }

    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("Connection timeout - device appears to be offline"));
    }, timeout);

    const cleanup = onConnectionChange(online => {
      if (online) {
        clearTimeout(timeoutId);
        cleanup();
        resolve();
      }
    });
  });
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a fetch function for tRPC with resilience built-in
 */
export function createResilientTRPCFetch(config: Partial<RetryConfig> = {}) {
  return async function resilientTRPCFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    return resilientFetch(
      input,
      {
        ...init,
        credentials: "include",
      },
      config
    );
  };
}
