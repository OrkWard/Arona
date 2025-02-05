import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        hostname: "*.file.myqcloud.com",
        protocol: "https",
      },
      {
        hostname: "r2.orkward.dev",
      },
      {
        hostname: "gchat.qpic.cn",
      },
    ],
  },
};

export default nextConfig;
