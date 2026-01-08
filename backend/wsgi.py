"""
WSGI Entry Point for Production Deployment
"""
import os
from app import create_app, create_socketio

# Create the Flask app with production config
app = create_app(os.getenv('FLASK_ENV', 'production'))

# Create SocketIO instance
socketio = create_socketio(app)

# This is used by gunicorn
application = app

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port)
