import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from app.server import app, application, handler
except Exception as e:
    def fallback_app(environ, start_response):
        start_response("200 OK", [("Content-Type", "application/json")])
        return [b'{"status": "ok", "message": "Vercel API fallback handler"}']

    app = fallback_app
    application = fallback_app
    handler = fallback_app
