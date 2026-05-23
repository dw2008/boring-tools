import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers: async () => [
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
