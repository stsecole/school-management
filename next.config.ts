import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow ZAI SDK to be loaded as external package (avoids webpack bundling issues)
  // Also mark playwright as external (used optionally for PDF generation; if not installed,
  // the route falls back to a 503 response at runtime)
  serverExternalPackages: ['z-ai-web-dev-sdk', 'playwright', '@playwright/test'],
  // Increase API route timeout for LLM calls
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
};

export default nextConfig;
