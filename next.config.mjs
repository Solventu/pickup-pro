import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hide the Next.js dev indicator ("N" badge) shown in development.
  devIndicators: false,
  // There is a stray package-lock.json in the parent folder, which made Next
  // infer the wrong workspace root and corrupted the routes manifest
  // (TypeError: routesManifest.dataRoutes is not iterable -> 500 on refresh).
  // Pin the root to this app so build + start agree.
  outputFileTracingRoot: __dirname,

  // Cloudflare Pages has no Next.js image optimizer — serve images as-is.
  images: {
    unoptimized: true,
  },

  // Baseline security headers applied to every response.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Disallow framing — defends against clickjacking.
          { key: "X-Frame-Options", value: "DENY" },
          // Don't let browsers MIME-sniff responses.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Send the origin (not the full path) on cross-origin navigations.
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Deny camera/mic/geolocation to the page and any embeds.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Legacy XSS filter (modern browsers ignore it, but harmless).
          { key: "X-XSS-Protection", value: "1; mode=block" },
        ],
      },
    ];
  },
};

export default nextConfig;
