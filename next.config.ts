import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Preserve the repository's maintained agent contract when starting dev.
  agentRules: false,
  // Verification/reset URLs contain private tokens.
  logging: { incomingRequests: false },
};

export default nextConfig;
