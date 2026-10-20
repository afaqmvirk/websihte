"""Fixed entry point for one credential-free, networkless Vercel Sandbox job."""
import os
import resource
import sys

from validation import MAX_OUTPUT
from worker import main


if __name__ == "__main__":
    try:
        if os.geteuid() == 0:
            raise RuntimeError("An unprivileged worker is required")
        os.umask(0o077)
        for limit, value in (
            (resource.RLIMIT_AS, 1536 * 1024 * 1024),
            (resource.RLIMIT_CPU, 65),
            (resource.RLIMIT_FSIZE, MAX_OUTPUT),
            (resource.RLIMIT_NPROC, 96),
            (resource.RLIMIT_NOFILE, 256),
            (resource.RLIMIT_CORE, 0),
        ):
            resource.setrlimit(limit, (value, value))
        main("/tmp/result.bin")
    except Exception:
        print("Render failed", file=sys.stderr)
        sys.exit(1)
