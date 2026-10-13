import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // The home hero's layered photographs are served at 90; everything else at 75.
  images: { qualities: [75, 90] },
  // Local mail proofs, database state and credentials never belong in deployment traces.
  outputFileTracingExcludes: {
    "/*": ["./.local/**/*", "./.env.local", "./.env.*.local"],
  },
  // Preserve the repository's maintained agent contract when starting dev.
  agentRules: false,
  // Verification/reset URLs contain private tokens.
  logging: { incomingRequests: false },
};

export default nextConfig;
