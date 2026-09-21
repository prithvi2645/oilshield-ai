import os
import sys

# app/app.py is a local-run convenience wrapper only.
# For Vercel deployment the entrypoint is api/index.py — not this file.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.server import app, application, handler
