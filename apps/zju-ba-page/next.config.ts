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
        hostname: "r2.orkward.dev",
      },
    ],
  },
};

export default nextConfig;
