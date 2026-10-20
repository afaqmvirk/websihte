"""Authenticated render gateway. Requires a Docker host and HTTPS reverse proxy.

Every job runs in a fresh restricted container with no network, host mounts or
credentials. Never replace this with an in-process TeX/Python execution endpoint.
"""
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import re
import subprocess
import threading
import uuid

from validation import MAX_INPUT, MAX_OUTPUT, validate

SLOTS = threading.BoundedSemaphore(2)


def run_job(kind, value):
    image = os.environ.get("RENDER_WORKER_IMAGE", "stupideas-renderer:local")
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9./:_-]{0,200}", image):
        raise ValueError("Invalid worker image")
    name = f"sih-render-{uuid.uuid4().hex}"
    command = ["docker", "run", "--rm", "--name", name, "-i", "--network", "none", "--read-only",
               "--memory", "768m", "--cpus", "1", "--pids-limit", "96", "--cap-drop", "ALL",
               "--security-opt", "no-new-privileges", "--user", "65534:65534",
               "--tmpfs", "/tmp:rw,noexec,nosuid,size=256m,mode=1777",
               "--env", "HOME=/tmp", "--env", "XDG_CACHE_HOME=/tmp/cache",
               image, "python", "/app/worker.py", kind]
    try:
        result = subprocess.run(command, input=json.dumps(value).encode(), stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL, timeout=80, check=True)
        data = result.stdout
        if not 8 <= len(data) <= MAX_OUTPUT or (kind == "latex" and not data.startswith(b"%PDF-")) or (kind == "manim" and data[4:8] != b"ftyp"):
            raise ValueError("Invalid render output")
        return data
    finally:
        # Killing a timed-out docker CLI alone can leave its worker running.
        subprocess.run(["docker", "rm", "-f", name], stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL, timeout=10, check=False)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass  # No request text, source, credentials or generated content in logs.

    def respond(self, status, content=b"", content_type="text/plain"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self):
        token = os.environ.get("RENDERER_TOKEN", "")
        supplied = self.headers.get("Authorization", "")
        if len(token) < 32 or not hmac.compare_digest(supplied.encode(), f"Bearer {token}".encode()):
            return self.respond(401)
        if self.path not in ("/render/manim", "/render/latex"):
            return self.respond(404)
        if not SLOTS.acquire(blocking=False):
            return self.respond(429)
        try:
            self.connection.settimeout(10)
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= MAX_INPUT or self.headers.get("Transfer-Encoding"):
                return self.respond(413)
            if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                return self.respond(415)
            raw = self.rfile.read(length)
            if len(raw) != length:
                return self.respond(400)
            kind = self.path.rsplit("/", 1)[1]
            value = validate(kind, json.loads(raw))
            data = run_job(kind, value)
            return self.respond(200, data, "application/pdf" if kind == "latex" else "video/mp4")
        except (ValueError, TypeError, KeyError):
            return self.respond(400)
        except Exception:
            return self.respond(503)
        finally:
            SLOTS.release()


if __name__ == "__main__":
    if len(os.environ.get("RENDERER_TOKEN", "")) < 32:
        raise SystemExit("Set RENDERER_TOKEN to a random server-only token of at least 32 characters")
    ThreadingHTTPServer((os.environ.get("RENDER_BIND", "127.0.0.1"), int(os.environ.get("PORT", "8788"))), Handler).serve_forever()
