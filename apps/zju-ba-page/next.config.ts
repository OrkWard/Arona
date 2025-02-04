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
        hostname: "multimedia.nt.qq.com.cn",
      },
      {
        hostname: "gchat.qpic.cn",
      },
    ],
  },
};

export default nextConfig;
