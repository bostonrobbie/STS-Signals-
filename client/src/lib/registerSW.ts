/**
 * Service Worker Registration
 * Registers the service worker for caching and offline support
 */

export function registerServiceWorker() {
  // Only register in production and if service workers are supported
  if (!("serviceWorker" in navigator)) {
    console.log("[SW] Service workers not supported");
    return;
  }

  // Register service worker
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(registration => {
        console.log("[SW] Service worker registered:", registration.scope);

        // Check for updates periodically
        setInterval(
          () => {
            registration.update();
          },
          60 * 60 * 1000
        ); // Check every hour

        // Handle updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // New service worker available
              console.log("[SW] New version available");

              // Optionally notify user or auto-update
              // For now, we'll auto-activate
              newWorker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch(error => {
        console.error("[SW] Service worker registration failed:", error);
      });

    // Handle controller change (new service worker activated)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      console.log("[SW] New service worker activated");
      // Optionally reload the page
      // window.location.reload();
    });
  });
}

/**
 * Unregister service worker (for debugging)
 */
export async function unregisterServiceWorker() {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
    }
    console.log("[SW] Service worker unregistered");
  }
}

/**
 * Clear all caches (for debugging)
 */
export async function clearCaches() {
  if ("caches" in window) {
    // eslint-disable-next-line no-undef
    const cacheNames = await caches.keys();
    // eslint-disable-next-line no-undef
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log("[SW] All caches cleared");
  }
}
