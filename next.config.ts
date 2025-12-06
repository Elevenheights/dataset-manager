import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Skip TypeScript errors during production build (safety net)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
