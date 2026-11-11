import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Run Next.js as a Node service so middleware can issue a fresh CSP nonce
  // for every request. Static export cannot provide per-request nonces.
  images: { unoptimized: true },
  trailingSlash: false,
};

export default nextConfig;
