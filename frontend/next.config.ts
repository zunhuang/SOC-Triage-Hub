import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 60
    }
  }
};

export default nextConfig;
