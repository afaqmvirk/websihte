import { after } from "next/server";
import { getDiscordBotConfigs, isDiscordCronAuthorized } from "@/lib/discord-bot";
import { runDiscordGateway } from "@/lib/discord-gateway";

export const runtime = "nodejs";
export const maxDuration = 800;

export async function GET(request: Request) {
  if (!isDiscordCronAuthorized(request)) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const configs = getDiscordBotConfigs();
  if (!configs.length) return Response.json({ status: "disabled" });
  after(async () => { await Promise.allSettled(configs.map((config) => runDiscordGateway(config))); });
  return Response.json({ status: "starting", bots: configs.map(({ persona }) => persona), listenerSeconds: 600 });
}
