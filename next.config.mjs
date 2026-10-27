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

  // Don't advertise the framework in every response.
  poweredByHeader: false,

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
          // Force HTTPS for two years, including subdomains.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Isolate the page from cross-origin windows it opens.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // Block plugins, <base> hijacking and framing. A full script/style CSP
          // is not set here because Mapbox and Next.js inline scripts need a
          // carefully tested policy.
          {
            key: "Content-Security-Policy",
            value: "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
