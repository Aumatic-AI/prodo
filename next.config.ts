import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NEXT_DIST_DIR lets a check build run in its own folder without breaking a running dev server
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [
      // Cloudflare R2 public address (NEXT_PUBLIC_MEDIA_URL)
      { protocol: "https", hostname: "**.r2.dev" },
    ],
  },
};

export default nextConfig;
