import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["discord.js", "opusscript"],
  outputFileTracingIncludes: {
    "/api/discord/gateway": ["./public/discord/krab/*.jpg", "./public/discord/squd/*.ogg",
      "./public/discord/squd/samples/*.pcm", "./node_modules/opusscript/build/*.wasm", "./node_modules/opusscript/build/*.js"],
  },
};

export default nextConfig;
