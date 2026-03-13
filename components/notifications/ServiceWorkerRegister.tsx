'use client';

import { useEffect } from 'react';

/**
 * Registers the push service worker early so it can receive push events when the app
 * is in the background. Push subscription (and permission) still happen when the user
 * enables notifications in chat or admin; this only ensures the SW is installed.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Ignore: push may not be supported (e.g. insecure context, old browser)
    });
  }, []);
  return null;
}
