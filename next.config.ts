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
  // Standalone output - creates self-contained minimal build
  // Compiles and minifies all source code (harder to steal)
  output: 'standalone',
  // Additional minification for production
  productionBrowserSourceMaps: false, // Don't generate source maps
  compress: true, // Enable compression
};

export default nextConfig;
