import fs from "node:fs/promises";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { Sandbox } from "@vercel/sandbox";

// Build trusted repository files in a disposable VM. This is an operator tool,
// never a user-facing endpoint or a place to execute generated source.
const repository = process.argv[2];
if (!/^vcr\.vercel\.com\/[a-z0-9_-]+\/[a-z0-9_-]+\/[a-z0-9_-]+$/.test(repository || "")) {
  throw new Error("Usage: node scripts/build-discord-renderer.mjs vcr.vercel.com/TEAM/PROJECT/REPOSITORY");
}
const token = process.env.VERCEL_OIDC_TOKEN;
if (!token || token === "[SENSITIVE]") throw new Error("Load the linked project's Vercel OIDC token with --env-file");
const names = ["Dockerfile", "worker.py", "validation.py", "sandbox_worker.py"];
const files = await Promise.all(names.map(async (name) => ({
  path: `renderer-image/${name}`, content: await fs.readFile(`services/discord-renderer/${name}`),
})));
const hash = crypto.createHash("sha256");
for (const file of files) hash.update(file.content);
const tag = `worker-${hash.digest("hex").slice(0, 12)}`;
const reference = `${repository}:${tag}`;
const log = await fs.open(".render-vercel-build.log", "w");
let sandbox;
try {
  console.log("Creating temporary Vercel image builder");
  sandbox = await Sandbox.create({
    persistent: false, resources: { vcpus: 2 }, timeout: 20 * 60_000,
    tags: { purpose: "discord-renderer-build" },
  });
  async function run(label, params, privateOutput = false) {
    console.log(label);
    const result = await sandbox.runCommand(params);
    if (!privateOutput) await log.write(`\n${label}\n${await result.stdout()}\n${await result.stderr()}`);
    if (result.exitCode !== 0) throw new Error(`${label} failed with exit code ${result.exitCode}`);
    return result;
  }
  await sandbox.mkDir("renderer-image");
  await sandbox.writeFiles(files);
  await run("Installing Docker", {
    cmd: "sh", args: ["-c", "command -v docker || (apt-get update && apt-get install -y docker.io)"],
    sudo: true, timeoutMs: 300_000,
  });
  await sandbox.runCommand({ cmd: "dockerd", sudo: true, detached: true });
  await run("Waiting for Docker", {
    cmd: "sh", args: ["-c", "for attempt in $(seq 1 30); do docker info >/dev/null 2>&1 && exit 0; sleep 1; done; exit 1"],
    sudo: true, timeoutMs: 40_000,
  });
  await run("Building worker image", {
    cmd: "docker", args: ["build", "--platform", "linux/amd64", "-t", reference, "renderer-image"],
    sudo: true, timeoutMs: 900_000,
  });
  await run("Authenticating private image push", {
    cmd: "docker", args: ["login", "vcr.vercel.com", "--username", "oidc", "--password-stdin"],
    stdin: Readable.from([token]), sudo: true, timeoutMs: 30_000,
  }, true);
  await run("Pushing private worker image", {
    cmd: "docker", args: ["push", reference], sudo: true, timeoutMs: 300_000,
  });
  const result = await run("Reading image digest", {
    cmd: "docker", args: ["image", "inspect", reference, "--format", "{{json .RepoDigests}}"],
    sudo: true, timeoutMs: 30_000,
  });
  const digest = JSON.parse(await result.stdout()).find((value) => value.startsWith(`${repository}@sha256:`))?.split("@")[1];
  if (!/^sha256:[a-f0-9]{64}$/.test(digest || "")) throw new Error("Pushed image digest is missing");
  const image = `${repository.split("/").at(-1)}@${digest}`;
  await fs.writeFile(".render-vercel-image.json", JSON.stringify({ reference, tag, digest, image }, null, 2));
  console.log(`DISCORD_RENDERER_IMAGE=${image}`);
} catch (error) {
  console.error("Worker image build failed:", error?.name === "APIError" ? error.name : error?.message || "Unknown failure");
  process.exitCode = 1;
} finally {
  if (sandbox) await sandbox.stop({ signal: AbortSignal.timeout(15_000) }).catch(() => {});
  await log.close();
}
