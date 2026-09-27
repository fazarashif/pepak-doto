import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite memuat file WASM sendiri, jadi jangan di-bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
