import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow ZAI SDK to be loaded as external package (avoids webpack bundling issues)
  serverExternalPackages: ['z-ai-web-dev-sdk'],
  // Increase API route timeout for LLM calls
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
};

export default nextConfig;
