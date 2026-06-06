import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@agentops/shared", "@agentops/ui"]
};

export default nextConfig;

