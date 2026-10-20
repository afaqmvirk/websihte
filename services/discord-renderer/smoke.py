"""Render real artifacts through the disposable Docker worker (no paid APIs)."""
import argparse
import json
from pathlib import Path
import subprocess

from server import run_job
from test_renderer import LATEX, SCENE

parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
for kind, payload, name in [("latex", LATEX, "document.pdf"), ("manim", SCENE, "animation.mp4")]:
    (args.output / name).write_bytes(run_job(kind, payload))
video = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                  "stream=codec_name,width,height,duration", "-of", "json", str(args.output / "animation.mp4")],
                                 capture_output=True, check=True).stdout)["streams"][0]
assert video["codec_name"] == "h264", video
assert (video["width"], video["height"]) == (854, 480), video
assert 2.9 <= float(video["duration"]) <= 3.2, video
print(json.dumps({"pdf": "ok", "video": video}))
