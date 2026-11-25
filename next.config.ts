import os from 'node:os';
import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

// Extract Supabase hostname from environment variable
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : null;

/** LAN IPv4s + .local / sslip.io / nip.io mirrors so a phone can load Next assets and finish Google OAuth. */
function getLanDevOrigins(): string[] {
  // Private LAN wildcards so phone HMR works even if the PC IP changes after boot.
  const origins = [
    'localhost',
    '127.0.0.1',
    '192.168.*.*',
    '10.*.*.*',
    '172.16.*.*',
    '172.17.*.*',
    '172.18.*.*',
    '172.19.*.*',
    '172.20.*.*',
    '172.21.*.*',
    '172.22.*.*',
    '172.23.*.*',
    '172.24.*.*',
    '172.25.*.*',
    '172.26.*.*',
    '172.27.*.*',
    '172.28.*.*',
    '172.29.*.*',
    '172.30.*.*',
    '172.31.*.*',
  ];
  const machine = os.hostname().split('.')[0];
  if (machine) origins.push(`${machine}.local`);
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      // Node may report family as 'IPv4' or 4 depending on version.
      const isV4 = addr.family === 'IPv4' || String(addr.family) === '4';
      if (isV4 && !addr.internal) {
        origins.push(addr.address);
        // Phone Google OAuth hops raw IPs to a hostname (Supabase rejects IP redirectTo).
        origins.push(`${addr.address.replace(/\./g, '-')}.sslip.io`);
        origins.push(`${addr.address}.nip.io`);
      }
    }
  }
  // Optional fixed hostname (ngrok / Cloudflare tunnel) that works on any network.
  const override = process.env.NEXT_PUBLIC_DEV_LAN_ORIGIN?.trim();
  if (override) {
    try {
      origins.push(new URL(override).hostname);
    } catch {
      // ignore malformed override
    }
  }
  return [...new Set(origins)];
}

/** CSP connect-src entries for the dev LAN hosts (any port: the phone probes them before hopping). */
function devConnectSrc(): string {
  return getLanDevOrigins()
    // CSP allows `*` only as the leftmost label, so IP ranges like 192.168.*.* are invalid there
    // (they stay in allowedDevOrigins). The machine's actual LAN IPs are listed on their own.
    .filter((host) => !host.includes('*'))
    .map((host) => `http://${host}:*`)
    .join(' ');
}

const nextConfig: NextConfig = {
  // Hide the dev-only "N" route indicator; it sat on top of the mobile bottom bar. Errors still show.
  devIndicators: false,
  outputFileTracingIncludes: {
    "/api/chat/messages": ["./lib/chat/probot-hardscape.md"],
  },
  // Types are checked by `tsc --noEmit` in the build script, before `next build` starts.
  // Running the check inside next build, next to the webpack workers, ran Vercel out of memory (8 GB).
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    webpackMemoryOptimizations: true,
    optimizePackageImports: [
      'react-icons/gi',
      'react-icons/si',
      'react-icons/md',
      'react-icons/hi',
      'react-icons/gr',
      'react-icons/lu',
      'react-icons/bs',
      'react-icons/tb',
    ],
  },
  // Allow cross-origin requests from local network during development.
  // sslip.io hostnames let Google OAuth return to a LAN phone without a raw IP redirectTo.
  // Without this, phones on http://192.168.x.x:3000 get /_next/hmr 403s and remount storms
  // (stuck Loading… + presence spam). Restart `next dev` after changing this list.
  allowedDevOrigins: (() => {
    const origins = getLanDevOrigins();
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[next.config] allowedDevOrigins (${origins.length}):`, origins.join(', '));
    }
    return origins;
  })(),
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
      {
        protocol: 'https',
        hostname: 'hzhyuuiovwayblkovfpr.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
    // Configure supported image qualities
    qualities: [75, 90],
  },
  async redirects() {
    return [
      { source: '/:locale(en|es|pt)/places', destination: '/:locale/myplaces', permanent: false },
      { source: '/:locale(en|es|pt)/places/:id', destination: '/:locale/myplaces/:id', permanent: false },
    ];
  },
  async rewrites() {
    return [
      { source: '/llms.txt', destination: '/api/agent/discovery/llms' },
      { source: '/.well-known/mcp/server-card.json', destination: '/api/agent/discovery/server-card' },
      { source: '/.well-known/api-catalog', destination: '/api/agent/discovery/api-catalog' },
    ];
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
            value: 'camera=(self), microphone=(self), geolocation=(self)',
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
              "img-src 'self' blob: data: https: https://maps.googleapis.com https://*.googleapis.com https://*.gstatic.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              // Video and audio: ProDrive files come from Supabase Storage as signed https links;
              // blob: covers clips previewed before upload.
              "media-src 'self' blob: data: https:",
              // https: does not allow websockets. Dev needs ws: for the hot-reload socket
              // (ws://<lan-ip>:3000/_next/hmr). Production only allows the Supabase socket.
              process.env.NODE_ENV === 'development'
                ? `connect-src 'self' https: ws: wss: ${devConnectSrc()} http://*.local:* https://maps.googleapis.com https://*.googleapis.com`
                : "connect-src 'self' https: wss://*.supabase.co https://maps.googleapis.com https://*.googleapis.com",
              "base-uri 'self'",
              "object-src 'none'",
              "form-action 'self'",
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