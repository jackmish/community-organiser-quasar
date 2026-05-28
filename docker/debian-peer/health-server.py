#!/usr/bin/env python3
"""Minimal HTTP server for Docker connection smoke tests."""

from http.server import BaseHTTPRequestHandler, HTTPServer

HOST = "0.0.0.0"
PORT = 9080


class HealthHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_GET(self):
        if self.path in ("/", "/health"):
            body = b'{"ok":true,"service":"co21-debian-peer"}\n'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        self.send_response(404)
        self.end_headers()


if __name__ == "__main__":
    server = HTTPServer((HOST, PORT), HealthHandler)
    print(f"health-server listening on {HOST}:{PORT}", flush=True)
    server.serve_forever()
