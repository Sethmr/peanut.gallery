import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable server-side streaming for SSE routes
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
