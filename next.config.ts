import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The Dockerfile runs `.next/standalone/server.js`, which only exists with this set.
  output: "standalone",
  // Dev server only: the offline (service worker) e2e check loads the app from this alias
  // host, because the worker stays off on localhost. Ignored by production builds.
  allowedDevOrigins: ["e2e-pwa.test"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  turbopack: {},
}

export default nextConfig
