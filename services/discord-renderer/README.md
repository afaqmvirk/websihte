# Discord document and animation renderer

Sand and Plank send SVG and `.tex` source directly from the Vercel bot. Rendered
PDFs and Manim MP4s use this small service on a **separate Linux Docker host**.
Vercel does not provide the Docker daemon, Cairo/Pango, and TeX runtime this needs.

Build the worker image from this directory:

```sh
docker build -t stupideas-renderer:local .
```

Run `python server.py` on that host with `RENDERER_TOKEN` set to a random secret
of at least 32 characters. `PORT` defaults to `8788` and `RENDER_BIND` to
`127.0.0.1`. Put an HTTPS reverse proxy in front of it. The host account running
the server needs Docker access; keep the gateway and Docker socket private.
Set `RENDER_WORKER_IMAGE` if using another built image tag. Do not mount the
Docker socket in a worker or run the worker directly on the public service host.

Set matching **server-only** Vercel variables:

```dotenv
DISCORD_RENDERER_URL=https://your-render-host.example
DISCORD_RENDERER_TOKEN=<same random token>
DISCORD_BOT_RENDER_DAILY_LIMIT=25
```

`POST /render/latex` accepts `{"source":"<complete standalone LaTeX document>"}`
and returns `application/pdf`. `POST /render/manim` accepts the fixed scene
protocol in `validation.py` and returns `video/mp4`. Both require bearer auth.
The bot attaches the original `.tex` alongside a rendered PDF. It sends an MP4
as a normal video attachment rather than a voice message or link.

Each job gets a fresh unprivileged container with no credentials, host mounts,
network, writable root, or Linux capabilities. `/tmp` is a size-limited tmpfs.
The job has one CPU, 768 MiB memory, 96 processes, and an 80-second deadline;
the container is removed even after a timeout. LaTeX disables shell escape.
Manim uses fixed Python code to interpret validated shape/text/actions; neither
generated Python nor mathematical expressions are evaluated. Two jobs can run
at once. JSON inputs are at most 64 KB, source at most 24 KB, and outputs at most
8 MB. PDFs have at most six pages; animations have at most twelve objects, sixteen steps and fifteen
seconds at 854×480 / 24 fps. Objects support show, hide, move, rotate, indicate
and wait. Files and source disappear with the container. Request logs are off.

The Vercel bot additionally requires a human-triggered tracked request and
claims a private shared render allowance: 25 attempts per UTC day by default
and one per human per minute across Sand and Plank. Provider failures still
spend the attempt. Bot-to-bot exchanges and unpinged name checks cannot render.
Missing configuration hides rendering tools without disabling source files.

Run `python -m unittest discover -s services/discord-renderer -p 'test_*.py'`
from the repository root for validation, auth, limits and worker lifecycle tests.
For an actual container smoke test, build the image then run
`python services/discord-renderer/smoke.py --output <temporary-directory>`.
It checks a real PDF and MP4 and probes video resolution and duration. The Docker
daemon must be running; no Discord posts or model calls are needed.
The `Discord renderer` pull-request workflow runs this same container check on
Linux and saves both generated files as a short-lived CI artifact.
