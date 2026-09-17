from __future__ import annotations
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse


class CoreAPI:
    def __init__(self, cfg, core):
        self.cfg = cfg
        self.core = core
        self.server = None
        self.thread = None

    def _handler(self):
        parent = self
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                return
            def _json(self, data, code=200):
                payload = json.dumps(data).encode()
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", parent.cfg.cors_origin)
                self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers(); self.wfile.write(payload)
            def do_OPTIONS(self):
                self._json({}, 204)
            def _body(self):
                n = int(self.headers.get("Content-Length", "0"))
                raw = self.rfile.read(n) if n else b"{}"
                try: return json.loads(raw or b"{}")
                except Exception: return {}
            def do_GET(self):
                p = urlparse(self.path).path
                if p in ("/", "/health"):
                    self._json({"ok": True, "service": "elo-core"}); return
                if p == "/status":
                    self._json(parent.core.snapshot()); return
                if p == "/targets":
                    self._json({"targets": parent.core.targets()}); return
                if p == "/audio/status":
                    self._json(parent.core.audio.snapshot()); return
                self.send_error(404)
            def do_POST(self):
                p = urlparse(self.path).path
                data = self._body()
                try:
                    if p == "/target":
                        ok, msg = parent.core.select_target(data.get("target_id"))
                        self._json({"ok": ok, "message": msg}, 200 if ok else 400); return
                    if p == "/mode":
                        mode = str(data.get("mode", "")).upper()
                        ok, msg = parent.core.set_mode(mode)
                        self._json({"ok": ok, "message": msg, "status": parent.core.snapshot()}, 200 if ok else 400); return
                    if p == "/stop":
                        parent.core.stop_robot()
                        self._json({"ok": True, "status": parent.core.snapshot()}); return
                    if p == "/interaction/start":
                        ok, msg = parent.core.start_interaction()
                        self._json({"ok": ok, "message": msg}); return
                    if p == "/audio/start":
                        ok, msg = parent.core.start_recording()
                        self._json({"ok": ok, "message": msg}, 200 if ok else 400); return
                    if p == "/audio/stop":
                        result = parent.core.stop_recording()
                        self._json(result, 200 if result.get("ok") else 400); return
                    if p == "/interaction/end":
                        parent.core.end_interaction()
                        self._json({"ok": True}); return
                except Exception as exc:
                    self._json({"ok": False, "error": str(exc)}, 500); return
                self.send_error(404)
        return Handler

    def start(self):
        self.server = ThreadingHTTPServer((self.cfg.api_host, self.cfg.api_port), self._handler())
        self.thread = threading.Thread(target=self.server.serve_forever, name="elo-core-api", daemon=True)
        self.thread.start()

    def stop(self):
        if self.server:
            self.server.shutdown()
