"""Small fixed scene protocol; no generated Python or expressions are evaluated."""
import math
import re

MAX_INPUT = 64_000
MAX_SOURCE = 24_000
MAX_OUTPUT = 8_000_000
KINDS = {"text", "circle", "square", "triangle", "arrow", "dot"}
COLORS = {"white", "red", "orange", "yellow", "green", "blue", "purple", "pink"}
ACTIONS = {"show", "hide", "move", "rotate", "indicate", "wait"}


def fields(value, names):
    if not isinstance(value, dict) or set(value) != set(names.split()):
        raise ValueError("Invalid fields")


def number(value, low, high):
    return type(value) in (int, float) and math.isfinite(value) and low <= value <= high


def validate(kind, value):
    if kind == "latex":
        fields(value, "source")
        source = value["source"]
        if (not isinstance(source, str) or not 0 < len(source.encode()) <= MAX_SOURCE
                or "\0" in source or not re.search(r"\\documentclass(?:\[[^\]]*\])?\{[a-z]+\}", source, re.I)
                or r"\begin{document}" not in source or r"\end{document}" not in source):
            raise ValueError("A complete LaTeX document is required")
        return value
    if kind != "manim":
        raise ValueError("Unknown render format")
    fields(value, "objects steps")
    objects, steps = value["objects"], value["steps"]
    if not isinstance(objects, list) or not 1 <= len(objects) <= 12 or not isinstance(steps, list) or not 1 <= len(steps) <= 16:
        raise ValueError("Scene exceeds limits")
    ids, visible = set(), set()
    for item in objects:
        fields(item, "id kind text color x y scale")
        if (not isinstance(item["id"], str) or not re.fullmatch(r"[a-z][a-z0-9_]{0,23}", item["id"])
                or item["id"] in ids or item["kind"] not in KINDS or item["color"] not in COLORS
                or not number(item["x"], -6, 6) or not number(item["y"], -3, 3) or not number(item["scale"], .25, 2)):
            raise ValueError("Invalid scene object")
        if item["kind"] == "text":
            if not isinstance(item["text"], str) or not item["text"].strip() or len(item["text"]) > 120:
                raise ValueError("Invalid text label")
        elif item["text"] is not None:
            raise ValueError("Only text objects have labels")
        ids.add(item["id"])
    duration, shown = 0, False
    for step in steps:
        fields(step, "action target x y angle seconds")
        action, target = step["action"], step["target"]
        if action not in ACTIONS or not number(step["seconds"], .25, 3):
            raise ValueError("Invalid action")
        duration += step["seconds"]
        if duration > 15:
            raise ValueError("Animation exceeds fifteen seconds")
        if action == "wait":
            if target is not None:
                raise ValueError("Wait cannot target an object")
        else:
            if not isinstance(target, str) or target not in ids:
                raise ValueError("Unknown target")
            if action == "show":
                if target in visible:
                    raise ValueError("Object is already visible")
                visible.add(target)
                shown = True
            elif target not in visible:
                raise ValueError("Object must be shown first")
            if action == "hide":
                visible.remove(target)
        if action == "move":
            if not number(step["x"], -6, 6) or not number(step["y"], -3, 3):
                raise ValueError("Invalid movement")
        elif step["x"] is not None or step["y"] is not None:
            raise ValueError("Unexpected coordinates")
        if action == "rotate":
            if not number(step["angle"], -360, 360):
                raise ValueError("Invalid rotation")
        elif step["angle"] is not None:
            raise ValueError("Unexpected angle")
    if not shown:
        raise ValueError("Scene must show an object")
    return value
