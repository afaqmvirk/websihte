import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["discord.js"],
  outputFileTracingIncludes: {
    "/api/discord/gateway": ["./public/discord/krab/*.jpg", "./public/discord/squd/*.ogg", "./public/discord/gerald/*.ogg"],
  },
};

export default nextConfig;
