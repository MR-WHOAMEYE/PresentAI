"""
Presentation Coach - Main Flask Application
AI-powered presentation coaching assistant
"""
import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from pymongo import MongoClient
import certifi
from config import config

# Global instances
mongo_client = None
db = None
socketio = None


def get_db():
    """Get database instance"""
    global db
    return db


def create_app(config_name='default'):
    """Application factory"""
    global mongo_client, db
    
    app = Flask(__name__)
    
    # Disable strict slashes to prevent redirects
    app.url_map.strict_slashes = False
    
    # Load configuration
    app.config.from_object(config[config_name])
    
    # Configure session cookies for cross-origin support
    app.config['SESSION_COOKIE_SAMESITE'] = 'None'
    app.config['SESSION_COOKIE_SECURE'] = True
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    
    # Initialize CORS - build list of allowed origins
    frontend_url = app.config.get('FRONTEND_URL', 'http://localhost:5173').rstrip('/')
    allowed_origins = [
        frontend_url,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "https://presentai-frontend.vercel.app",
        "https://presentai-frontend-tharankeswarans-projects.vercel.app",
    ]
    # Add any Vercel preview URLs pattern
    CORS(app, 
         resources={r"/*": {"origins": allowed_origins}},
         supports_credentials=True,
         allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
    
    # Initialize MongoDB
    mongo_uri = app.config.get('MONGO_URI')
    if mongo_uri:
        mongo_client = MongoClient(mongo_uri, tlsCAFile=certifi.where())
        db = mongo_client.get_database()
        app.extensions['mongo_db'] = db
        print(f"✅ Connected to MongoDB: {db.name}")
    
    # Register blueprints
    from routes.auth import auth_bp
    from routes.presentations import presentations_bp
    from routes.sessions import sessions_bp
    from routes.analyze import analyze_bp
    from routes.tts import tts_bp
    from routes.stt import stt_bp, register_socketio_handlers
    
    app.register_blueprint(auth_bp)
    app.register_blueprint(presentations_bp)
    app.register_blueprint(sessions_bp)
    app.register_blueprint(analyze_bp)
    app.register_blueprint(tts_bp)
    app.register_blueprint(stt_bp)
    
    # Health check endpoint
    @app.route('/health')
    def health_check():
        return jsonify({
            'status': 'healthy',
            'service': 'Presentation Coach API'
        })
    
    # Root endpoint
    @app.route('/')
    def index():
        return jsonify({
            'name': 'Presentation Coach API',
            'version': '1.0.0',
            'endpoints': {
                'auth': '/auth',
                'presentations': '/presentations',
                'sessions': '/sessions',
                'analyze': '/analyze'
            }
        })
    
    return app


def create_socketio(app):
    """Create and configure SocketIO instance"""
    global socketio
    
    # Get allowed origins from app config
    frontend_url = app.config.get('FRONTEND_URL', 'http://localhost:5173').rstrip('/')
    allowed_origins = [
        frontend_url,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "https://presentai-frontend.vercel.app",
        "https://presentai-frontend-tharankeswarans-projects.vercel.app",
    ]
    
    socketio = SocketIO(
        app,
        cors_allowed_origins=allowed_origins,
        async_mode='threading',
        ping_timeout=60,
        ping_interval=25
    )
    
    # Register STT socket handlers
    from routes.stt import register_socketio_handlers
    register_socketio_handlers(socketio)
    
    return socketio


if __name__ == '__main__':
    app = create_app(os.getenv('FLASK_ENV', 'development'))
    socketio = create_socketio(app)
    print("🚀 Starting server with WebSocket support...")
    # Note: use_reloader=False fixes Windows socket error with Flask-SocketIO
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, use_reloader=False, allow_unsafe_werkzeug=True)

