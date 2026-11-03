'use client';

import Image from 'next/image';

interface GoogleHandoffOverlayProps {
  open: boolean;
  title: string;
  subtitle: string;
}

const TRANSFER_DOTS = ['#4285F4', '#EA4335', '#FBBC05', '#34A853'];

/**
 * Full-screen handoff shown while the browser leaves for Google and while the
 * callback finishes. It mirrors the Google consent screen: the two accounts side
 * by side with the profile moving from one to the other.
 */
export function GoogleHandoffOverlay({ open, title, subtitle }: GoogleHandoffOverlayProps) {
  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-backdrop-fade-in fixed inset-0 z-[120] flex items-center justify-center bg-white/95 px-6 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
        <div className="flex items-center justify-center gap-3">
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm">
            <svg className="h-8 w-8" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          </span>

          <span className="relative flex h-6 w-24 items-center" aria-hidden="true">
            <span className="h-px w-full bg-gray-200" />
            {TRANSFER_DOTS.map((color, index) => (
              <span
                key={color}
                className="animate-google-transfer-dot absolute left-0 top-[calc(50%-0.25rem)] h-2 w-2 rounded-full"
                style={{ backgroundColor: color, animationDelay: `${index * 0.2}s` }}
              />
            ))}
          </span>

          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-gray-200 bg-white p-2 shadow-sm">
            <Image
              src="/hph-logo-simble-bot-v1.png"
              alt="House Pros Hub"
              width={48}
              height={48}
              className="h-full w-full object-contain"
            />
          </span>
        </div>

        <div className="space-y-2">
          <p className="text-lg font-semibold text-black">{title}</p>
          <p className="text-sm text-gray-600">{subtitle}</p>
        </div>

        <span className="h-1 w-full overflow-hidden rounded-full bg-gray-100">
          <span className="animate-google-transfer-bar block h-full w-1/3 rounded-full bg-black" />
        </span>
      </div>
    </div>
  );
}
