import { after } from "next/server";
import { getDiscordBotConfig, isDiscordCronAuthorized } from "@/lib/discord-bot";
import { runDiscordGateway } from "@/lib/discord-gateway";

export const runtime = "nodejs";
export const maxDuration = 800;

export async function GET(request: Request) {
  if (!isDiscordCronAuthorized(request)) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const config = getDiscordBotConfig();
  if (!config) return Response.json({ status: "disabled" });
  after(() => runDiscordGateway(config));
  return Response.json({ status: "starting", listenerSeconds: 600 });
}
