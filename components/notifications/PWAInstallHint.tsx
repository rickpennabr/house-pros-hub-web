'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const STORAGE_KEY = 'hph_pwa_install_hint_dismissed';
const FIRST_VISIT_KEY = 'hph_pwa_first_visit_done';

/**
 * On mobile, when the app is not installed (not running as standalone PWA),
 * show a dismissible hint to add to home screen so the user gets:
 * - App icon badge (red count on the HouseProsHub icon)
 * - Reliable push/banner notifications when the app is in background
 * Not shown on first user access; only on subsequent visits.
 */
export default function PWAInstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // Do not show on first visit; mark first visit and skip
      if (!localStorage.getItem(FIRST_VISIT_KEY)) {
        localStorage.setItem(FIRST_VISIT_KEY, '1');
        return;
      }
      if (sessionStorage.getItem(STORAGE_KEY) === '1') return;
      // Standalone = already installed (e.g. launched from home screen icon)
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (isStandalone) return;
      // Prefer showing on mobile/touch devices
      const isMobile =
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
        ('ontouchstart' in window && window.innerWidth < 1024);
      if (!isMobile) return;
      setShow(true);
    } catch {
      setShow(false);
    }
  }, []);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(dismiss, 5000);
    return () => clearTimeout(timer);
  }, [show]);

  const dismiss = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      role="status"
      className="fixed top-4 left-3 right-3 z-[100] max-w-md mx-auto rounded-xl bg-gray-900 text-white p-4 shadow-lg border border-gray-700 md:left-4 md:right-auto"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">See notifications on your app icon</p>
          <p className="text-xs text-gray-300 mt-1">
            Add House Pros Hub to your Home Screen so the red badge and reply notifications work when the app is closed.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Safari: Share → Add to Home Screen. Chrome: Menu → Install app.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
