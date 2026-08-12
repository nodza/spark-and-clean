import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.sparkandclean.co.za",
        pathname: "/wp-content/uploads/**",
      },
    ],
  },
};

export default nextConfig;
