// import type { NextConfig } from "next";
// import createNextIntlPlugin from 'next-intl/plugin';

// const withNextIntl = createNextIntlPlugin('./i18n.ts');

// // Extract Supabase hostname from environment variable
// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : null;

// const nextConfig: NextConfig = {
//   /* config options here */
//   // Allow cross-origin requests from local network during development
//   allowedDevOrigins: ['192.168.0.26'],
//   images: {
//     remotePatterns: [
//       {
//         protocol: 'https',
//         hostname: 'lh3.googleusercontent.com',
//       },
//       // Add Supabase storage hostname if available
//       ...(supabaseHostname ? [{
//         protocol: 'https' as const,
//         hostname: supabaseHostname,
//       }] : []),
//     ],
//     // Configure supported image qualities
//     qualities: [75, 90],
//   },
//   async headers() {
//     return [
//       {
//         // Apply security headers to all routes
//         source: '/:path*',
//         headers: [
//           {
//             key: 'X-DNS-Prefetch-Control',
//             value: 'on',
//           },
//           {
//             key: 'Strict-Transport-Security',
//             value: 'max-age=63072000; includeSubDomains; preload',
//           },
//           {
//             key: 'X-Frame-Options',
//             value: 'SAMEORIGIN',
//           },
//           {
//             key: 'X-Content-Type-Options',
//             value: 'nosniff',
//           },
//           {
//             key: 'X-XSS-Protection',
//             value: '1; mode=block',
//           },
//           {
//             key: 'Referrer-Policy',
//             value: 'origin-when-cross-origin',
//           },
//           {
//             key: 'Permissions-Policy',
//             value: 'camera=(), microphone=(), geolocation=()',
//           },
//           // Basic Content-Security-Policy - refine based on actual needs
//           {
//             key: 'Content-Security-Policy',
//             value: [
//               "default-src 'self'",
//               "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // 'unsafe-eval' needed for Next.js
//               "style-src 'self' 'unsafe-inline'", // 'unsafe-inline' needed for Tailwind
//               "img-src 'self' data: https:",
//               "font-src 'self' data:",
//               // Allow localhost connections in development for analytics/debugging
//               process.env.NODE_ENV === 'development'
//                 ? "connect-src 'self' https: http://localhost:* http://127.0.0.1:* http://127.0.0.1:7243"
//                 : "connect-src 'self' https:",
//               "frame-ancestors 'self'",
//             ].join('; '),
//           },
//         ],
//       },
//     ];
//   },
// };

// export default withNextIntl(nextConfig);





import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

// Extract Supabase hostname from environment variable
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : null;

const nextConfig: NextConfig = {
  /* config options here */
  // Allow cross-origin requests from local network during development
  allowedDevOrigins: ['192.168.0.26'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      // Add Supabase storage hostname if available
      ...(supabaseHostname ? [{
        protocol: 'https' as const,
        hostname: supabaseHostname,
      }] : []),
    ],
    // Configure supported image qualities
    qualities: [75, 90],
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // Content-Security-Policy with Google Maps support
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Allow Google Maps scripts
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://maps.googleapis.com https://*.googleapis.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Allow Google Maps images and tiles
              "img-src 'self' data: https: https://maps.googleapis.com https://*.googleapis.com https://*.gstatic.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              // Allow connections to Google Maps APIs
              process.env.NODE_ENV === 'development'
                ? "connect-src 'self' https: http://localhost:* http://127.0.0.1:* http://127.0.0.1:7243 https://maps.googleapis.com https://*.googleapis.com"
                : "connect-src 'self' https: https://maps.googleapis.com https://*.googleapis.com",
              "frame-ancestors 'self'",
              // Allow Google Maps worker scripts
              "worker-src 'self' blob:",
              // Allow child-src for Google Maps
              "child-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);