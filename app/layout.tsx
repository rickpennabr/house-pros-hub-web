import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
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

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

