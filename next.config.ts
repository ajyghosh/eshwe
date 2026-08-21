import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  async rewrites() {
    return [
      {
        source: "/product/:slug*",
        destination: "/product"
      },
      {
        source: "/shop/new-arrivals",
        destination: "/shop"
      },
      {
        source: "/shop/featured",
        destination: "/shop"
      },
      {
        source: "/shop/category/:slug*",
        destination: "/shop"
      }
    ];
  }
};

export default nextConfig;
