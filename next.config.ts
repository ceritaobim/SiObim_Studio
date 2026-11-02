import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    if (dev) {
      // Use memory cache in dev to prevent Windows file-lock collisions with pack files
      config.cache = { type: "memory" };
    }
    return config;
  },
};

export default nextConfig;
