import "./globals.css";
import { Suspense } from "react";
import { validateEnvVarsOrThrow } from "@/lib/utils/envValidation";

// Validate environment variables at runtime (not during build)
// This will throw an error if critical variables are missing
// The validation function automatically skips during build phase
if (typeof window === 'undefined') {
  // Only validate on server side, at runtime
  // During build, validation is skipped to allow builds to complete
  try {
    validateEnvVarsOrThrow();
  } catch (error) {
    // In production runtime, we want to fail fast
    // In development, we can be more lenient but still log the error
    // During build, this won't execute as validation is skipped
    if (process.env.NODE_ENV === 'production') {
      throw error;
    } else {
      console.error('Environment variable validation failed:', error);
      console.warn('Continuing in development mode, but please fix environment variables before deploying to production.');
    }
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/pro-bot-solo.gif" as="image" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <Suspense fallback={null}>{children}</Suspense>
      </body>
    </html>
  );
}

