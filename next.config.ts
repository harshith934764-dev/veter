import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the current Render Static Site deployment working.
  // Dynamic CSP nonces require a separate Node web service migration.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: false,
};

export default nextConfig;
