import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers: async () => [
    {
      // Allow same-origin iframes on all pages (Next.js 16 defaults to DENY)
      source: "/(.*)",
      headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
    },
    {
      // COOP/COEP required for Stockfish SharedArrayBuffer
      source: "/chess-app/:path*",
      headers: [
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
      ],
    },
    {
      // Correct MIME type for WASM files served from public/
      source: "/:path*.wasm",
      headers: [{ key: "Content-Type", value: "application/wasm" }],
    },
  ],
};

export default nextConfig;
