import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cursor / IDE preview may open via 127.0.0.1 while Next binds 0.0.0.0
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
