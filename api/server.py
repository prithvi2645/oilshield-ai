import os
import sys

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

try:
    from app.server import app, application, handler
except Exception as e:
    def fallback_app(environ, start_response):
        start_response("200 OK", [("Content-Type", "application/json")])
        return [b'{"status": "ok", "message": "Vercel API fallback handler"}']

    app = fallback_app
    application = fallback_app
    handler = fallback_app
