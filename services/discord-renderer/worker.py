"""Executed only in a fresh networkless, unprivileged disposable container."""
import contextlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

from validation import MAX_INPUT, MAX_OUTPUT, validate


def render_latex(value, directory):
    (directory / "document.tex").write_text(value["source"], encoding="utf-8")
    # The worker has no host mounts, API credentials, or network. TeX file access
    # remains inside this disposable container even on TeX versions that changed
    # openin_any. Shell escape is always disabled.
    env = {**os.environ, "shell_escape": "f", "openin_any": "p", "openout_any": "p"}
    for _ in range(2):
        subprocess.run(["pdflatex", "-no-shell-escape", "-halt-on-error", "-interaction=batchmode", "document.tex"],
                       cwd=directory, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                       timeout=20, check=True)
    pdf = directory / "document.pdf"
    info = subprocess.run(["pdfinfo", str(pdf)], capture_output=True, timeout=5, check=True).stdout.decode()
    pages = re.search(r"^Pages:\s+(\d+)\b", info, re.M)
    if not pages or not 1 <= int(pages[1]) <= 6:
        raise ValueError("Document exceeds six pages")
    return pdf


def render_manim(value, directory):
    from manim import Arrow, Circle, Dot, FadeIn, FadeOut, Indicate, Rotate, Scene, Square, Text, Triangle, tempconfig
    import numpy as np

    colors = {"white": "#FFFFFF", "red": "#FC6255", "orange": "#FF862F", "yellow": "#FFFF00",
              "green": "#83C167", "blue": "#58C4DD", "purple": "#9A72AC", "pink": "#D147BD"}

    class OverlordScene(Scene):
        def construct(self):
            objects = {}
            for item in value["objects"]:
                color = colors[item["color"]]
                if item["kind"] == "text":
                    obj = Text(item["text"], font="DejaVu Sans", font_size=32, color=color)
                    if obj.width > 11:
                        obj.scale_to_fit_width(11)
                elif item["kind"] == "arrow":
                    obj = Arrow(np.array([-1, 0, 0]), np.array([1, 0, 0]), color=color)
                else:
                    obj = {"circle": Circle, "square": Square, "triangle": Triangle, "dot": Dot}[item["kind"]](color=color)
                objects[item["id"]] = obj.scale(item["scale"]).move_to([item["x"], item["y"], 0])
            for step in value["steps"]:
                action, seconds = step["action"], step["seconds"]
                if action == "wait":
                    self.wait(seconds)
                    continue
                obj = objects[step["target"]]
                if action == "show":
                    animation = FadeIn(obj)
                elif action == "hide":
                    animation = FadeOut(obj)
                elif action == "move":
                    animation = obj.animate.move_to([step["x"], step["y"], 0])
                elif action == "rotate":
                    animation = Rotate(obj, angle=math.radians(step["angle"]))
                else:
                    animation = Indicate(obj)
                self.play(animation, run_time=seconds)

    with tempconfig({"media_dir": str(directory), "output_file": "animation", "pixel_width": 854,
                     "pixel_height": 480, "frame_width": 14, "frame_height": 8, "frame_rate": 24,
                     "disable_caching": True, "format": "mp4", "verbosity": "ERROR", "progress_bar": "none"}):
        scene = OverlordScene()
        scene.render()
        return Path(scene.renderer.file_writer.movie_file_path)


def main():
    kind = sys.argv[1]
    raw = sys.stdin.buffer.read(MAX_INPUT + 1)
    if len(raw) > MAX_INPUT:
        raise ValueError("Input exceeds limit")
    value = validate(kind, json.loads(raw))
    with tempfile.TemporaryDirectory(prefix="overlord-") as temp:
        directory = Path(temp)
        # Keep all library output out of the binary response.
        with contextlib.redirect_stdout(sys.stderr):
            result = render_latex(value, directory) if kind == "latex" else render_manim(value, directory)
        if not 8 <= result.stat().st_size <= MAX_OUTPUT:
            raise ValueError("Output exceeds limit")
        data = result.read_bytes()
        if kind == "latex" and not data.startswith(b"%PDF-") or kind == "manim" and data[4:8] != b"ftyp":
            raise ValueError("Invalid render output")
        sys.stdout.buffer.write(data)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("Render failed", file=sys.stderr)
        sys.exit(1)
