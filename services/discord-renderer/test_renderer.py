import copy
import json
import os
import subprocess
import threading
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from unittest.mock import patch

from server import Handler, run_job
from validation import validate

SCENE = {"objects": [{"id": "ball", "kind": "circle", "text": None, "color": "blue", "x": -2, "y": 0, "scale": 1}],
         "steps": [{"action": "show", "target": "ball", "x": None, "y": None, "angle": None, "seconds": 1},
                   {"action": "move", "target": "ball", "x": 2, "y": 0, "angle": None, "seconds": 2}]}
LATEX = {"source": r"\documentclass[border=8pt]{standalone}\usepackage{amsmath}\begin{document}$\displaystyle E=mc^2\qquad\sum_{k=1}^{n}k=\frac{n(n+1)}{2}$\end{document}"}


class ValidationTests(unittest.TestCase):
    def test_bounded_scene_and_complete_document(self):
        self.assertEqual(validate("manim", SCENE), SCENE)
        self.assertEqual(validate("latex", LATEX), LATEX)
        for payload in [{**SCENE, "python": "import os"}, {**SCENE, "objects": SCENE["objects"] * 2},
                        {**SCENE, "steps": [SCENE["steps"][1]]},
                        {**SCENE, "steps": SCENE["steps"] * 8}]:
            with self.assertRaises(ValueError):
                validate("manim", payload)
        with self.assertRaises(ValueError):
            validate("latex", {"source": "not a document"})

    def test_wrong_types_unknown_targets_and_nonfinite_values(self):
        for field, value in [("kind", "python"), ("x", True), ("scale", float("inf")), ("id", "../../secret")]:
            scene = copy.deepcopy(SCENE)
            scene["objects"][0][field] = value
            with self.assertRaises(ValueError):
                validate("manim", scene)

    @patch("server.subprocess.run")
    def test_disposable_container_has_limits_and_no_credentials_or_host_mounts(self, run):
        run.side_effect = [subprocess.CompletedProcess([], 0, stdout=b"%PDF-1.7\nfixture"), subprocess.CompletedProcess([], 0)]
        self.assertTrue(run_job("latex", LATEX).startswith(b"%PDF-"))
        args = run.call_args_list[0].args[0]
        self.assertEqual(args[args.index("--network") + 1], "none")
        self.assertIn("--read-only", args)
        self.assertIn("no-new-privileges", args)
        self.assertIn("65534:65534", args)
        self.assertNotIn("--volume", args)
        self.assertNotIn("--mount", args)
        self.assertNotIn("RENDERER_TOKEN", " ".join(args))
        self.assertEqual(run.call_args_list[-1].args[0][:3], ["docker", "rm", "-f"])

    @patch("server.subprocess.run")
    def test_timeout_always_removes_worker(self, run):
        run.side_effect = [subprocess.TimeoutExpired("docker", 80), subprocess.CompletedProcess([], 0)]
        with self.assertRaises(subprocess.TimeoutExpired):
            run_job("manim", SCENE)
        self.assertEqual(run.call_args_list[-1].args[0][:3], ["docker", "rm", "-f"])


class HttpTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"RENDERER_TOKEN": "r" * 40})
        self.env.start()
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.env.stop()

    def request(self, path, payload, token="r" * 40):
        connection = HTTPConnection(*self.server.server_address, timeout=5)
        connection.request("POST", path, json.dumps(payload), {"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
        response = connection.getresponse()
        result = response.status, response.getheader("Content-Type"), response.read()
        connection.close()
        return result

    @patch("server.run_job")
    def test_auth_validation_and_successful_binary_delivery(self, render):
        render.return_value = b"%PDF-1.7\nfixture"
        self.assertEqual(self.request("/render/latex", LATEX, "wrong")[0], 401)
        self.assertEqual(self.request("/render/python", LATEX)[0], 404)
        self.assertEqual(self.request("/render/manim", {"code": "import os"})[0], 400)
        self.assertEqual(render.call_count, 0)
        self.assertEqual(self.request("/render/latex", LATEX), (200, "application/pdf", b"%PDF-1.7\nfixture"))
        self.assertEqual(render.call_args.args, ("latex", LATEX))


if __name__ == "__main__":
    unittest.main()
