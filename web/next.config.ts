import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server mandiri untuk dijalankan systemd tanpa Docker (lihat infra/systemd/lapor-web.service).
  output: "standalone",
  // Build verifikasi bisa memakai folder lain (NEXT_DIST_DIR=.next-build) agar tidak bentrok dengan `next dev` yang sedang berjalan.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
