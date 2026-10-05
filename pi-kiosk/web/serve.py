#!/usr/bin/env python3
"""
FamCal Kiosk — Lightweight Local Static Web Server
Serves the FamCal PWA production distribution on port 8080 with Single Page
Application (SPA) fallback support and proper MIME types. Zero external dependencies.
"""

import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

WEB_DIR = "/var/www/famcal"
PORT = 8080

if len(sys.argv) > 1 and os.path.isdir(sys.argv[1]):
    WEB_DIR = sys.argv[1]
elif not os.path.isdir(WEB_DIR):
    # Fallback to local dist directory if running from repository
    repo_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../dist"))
    if os.path.isdir(repo_dist):
        WEB_DIR = repo_dist


class FamCalRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.end_headers()

    def do_GET(self):
        # Photo proxy with CORS
        if self.path.startswith("/api/photo"):
            try:
                import urllib.request
                from urllib.parse import parse_qs, urlparse

                query = parse_qs(urlparse(self.path).query)
                target_url = query.get("url", [None])[0]
                if not target_url or not target_url.startswith("https://"):
                    self.send_error(400, "Invalid target URL")
                    return

                req = urllib.request.Request(target_url)
                auth = self.headers.get("Authorization")
                if auth:
                    req.add_header("Authorization", auth)
                req.add_header("User-Agent", "FamCal/1.0")

                with urllib.request.urlopen(req, timeout=10) as response:
                    content = response.read()
                    content_type = response.headers.get("Content-Type", "image/jpeg")
                    self.send_response(200)
                    self.send_header("Content-Type", content_type)
                    self.send_header("Content-Length", str(len(content)))
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.send_header("Cache-Control", "public, max-age=86400")
                    self.end_headers()
                    self.wfile.write(content)
            except Exception as e:
                self.send_error(500, str(e))
            return

        # SPA routing: if path doesn't exist as a file, serve index.html
        path = self.translate_path(self.path)
        if not os.path.exists(path) and not os.path.splitext(self.path)[1]:
            self.path = "/index.html"
        return super().do_GET()

    def end_headers(self):
        # Enable caching for immutable assets, no-cache for index.html
        if self.path.startswith("/assets/"):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        elif self.path.endswith("index.html") or self.path == "/":
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

    def log_message(self, format, *args):
        # Keep logs clean
        pass


def run():
    if not os.path.exists(WEB_DIR):
        print(f"Warning: Web directory {WEB_DIR} does not exist yet.", file=sys.stderr)

    server_address = ("0.0.0.0", PORT)
    httpd = HTTPServer(server_address, FamCalRequestHandler)
    print(f"FamCal Local Web Server active at http://localhost:{PORT} serving {WEB_DIR}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down FamCal Web Server.")
        httpd.server_close()


if __name__ == "__main__":
    run()
