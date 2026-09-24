import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for non-Vercel deployment (Render, Docker, etc.)
  output: 'standalone',
  // Allow larger request bodies for image OCR uploads (up to 5MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  // Turbopack is default in Next.js 16. Use turbopack config instead of webpack.
  // Silence the webpack/turbopack conflict and alias canvas for pdfjs-dist.
  turbopack: {
    resolveAlias: {
      // pdfjs-dist tries to require 'canvas' in node environments; stub it out
      canvas: './src/lib/empty-module.ts',
    },
  },
  // COEP/COOP headers required for SharedArrayBuffer used by Tesseract.js WASM
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "credentialless",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline'; worker-src 'self' blob: https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com; connect-src 'self' https: blob:; img-src 'self' data: blob:;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
