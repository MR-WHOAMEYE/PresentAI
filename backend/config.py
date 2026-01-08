"""
Flask Application Configuration
"""
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Base configuration"""
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    
    # MongoDB
    MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/presentation_coach')
    
    # Google OAuth
    GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
    GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
    GOOGLE_REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:5000/auth/callback')
    
    # Google API Scopes
    GOOGLE_SCOPES = [
        'openid',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/presentations',
        'https://www.googleapis.com/auth/drive.readonly'
    ]
    
    # Gemini API
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
    
    # CORS
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    
    # Redis Cache
    REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    CACHE_TTL = int(os.getenv('CACHE_TTL', 3600))  # 1 hour default
    
    # LangCache (Semantic Caching)
    LANGCACHE_API_KEY = os.getenv('LANGCACHE_API_KEY')
    LANGCACHE_SERVER_URL = os.getenv('LANGCACHE_SERVER_URL', 'https://aws-us-east-1.langcache.redis.io')
    LANGCACHE_CACHE_ID = os.getenv('LANGCACHE_CACHE_ID', '9c85ec4de23544b196d00466aa65bf9d')
    
    # Cloudflare Workers AI
    CLOUDFLARE_ACCOUNT_ID = os.getenv('CLOUDFLARE_ACCOUNT_ID')
    CLOUDFLARE_API_TOKEN = os.getenv('CLOUDFLARE_API_TOKEN')
    
    # ElevenLabs TTS
    ELEVENLABS_API_KEY = os.getenv('ELEVENLABS_API_KEY')
    
    # Cloudinary
    CLOUDINARY_URL = os.getenv('CLOUDINARY_URL')

    # Vercel Blob
    BLOB_READ_WRITE_TOKEN = os.getenv('BLOB_READ_WRITE_TOKEN')


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
