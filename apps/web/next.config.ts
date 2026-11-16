import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output: the Docker image ships only the traced server files (see web.Dockerfile).
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@agentops/shared", "@agentops/ui"]
};

export default nextConfig;
