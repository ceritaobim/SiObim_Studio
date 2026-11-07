import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer, dev }) => {
    if (dev) {
      // Use memory cache in dev to prevent Windows file-lock collisions with pack files
      config.cache = { type: "memory" };
    }
    if (!isServer) {
      config.resolve = {
        ...config.resolve,
        fallback: {
          ...config.resolve?.fallback,
          fs: false,
          net: false,
          tls: false,
          child_process: false,
        },
      };
    }
    return config;
  },
};

export default nextConfig;
