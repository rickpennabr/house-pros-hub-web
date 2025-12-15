import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Allow cross-origin requests from local network during development
  allowedDevOrigins: ['192.168.0.26'],
};

export default nextConfig;
