import os
import sys
from pathlib import Path

# Add the backend directory to sys.path so its internal imports work
backend_path = Path(__file__).parent.parent / "backend"
sys.path.append(str(backend_path))

from app import create_app

# Create the flask app for Vercel
app = create_app(os.getenv('FLASK_ENV', 'production'))

# Technical note: Vercel's Python runtime will detect the 'app' object
# or a 'handler' variable. 
