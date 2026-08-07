import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@narrlight/shared"],
  experimental: {
    optimizePackageImports: ["antd", "lucide-react", "@ant-design/icons"],
  },
};

export default nextConfig;
