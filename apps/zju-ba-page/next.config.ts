import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "export",
  reactStrictMode: true,
  basePath: "/zju-ba/essence",
  images: {
    unoptimized: true,
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
