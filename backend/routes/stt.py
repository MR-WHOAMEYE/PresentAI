"""
Speech-to-Text Routes - Real-time transcription using faster-whisper
Provides both HTTP and WebSocket endpoints for transcription
With Redis caching for repeated audio patterns
"""
import os
import io
import base64
import hashlib
import tempfile
import json
from flask import Blueprint, request, jsonify, current_app
from flask_socketio import emit

stt_bp = Blueprint('stt', __name__, url_prefix='/stt')

# Lazy-loaded instances
_whisper_model = None
_redis_client = None


def get_redis_client():
    """Lazy load Redis client"""
    global _redis_client
    if _redis_client is None:
        redis_url = os.getenv('REDIS_URL')
        if redis_url:
            try:
                import redis
                _redis_client = redis.from_url(redis_url, decode_responses=True)
                _redis_client.ping()
                print(f"✅ Connected to Redis cache")
            except Exception as e:
                print(f"⚠️ Redis not available: {e}")
                _redis_client = False  # Mark as unavailable
        else:
            print("ℹ️ REDIS_URL not set, caching disabled")
            _redis_client = False
    return _redis_client if _redis_client else None


def get_cache_key(audio_data: bytes) -> str:
    """Generate cache key from audio content hash"""
    audio_hash = hashlib.sha256(audio_data).hexdigest()[:16]
    return f"stt:v1:{audio_hash}"


def get_cached_transcription(audio_data: bytes):
    """Try to get transcription from cache"""
    redis = get_redis_client()
    if not redis:
        return None
    
    try:
        cache_key = get_cache_key(audio_data)
        cached = redis.get(cache_key)
        if cached:
            print(f"🎯 Cache hit: {cache_key}")
            return json.loads(cached)
    except Exception as e:
        print(f"Cache read error: {e}")
    return None


def cache_transcription(audio_data: bytes, result: dict, ttl: int = 3600):
    """Cache transcription result (default 1 hour TTL)"""
    redis = get_redis_client()
    if not redis:
        return
    
    try:
        cache_key = get_cache_key(audio_data)
        redis.setex(cache_key, ttl, json.dumps(result))
        print(f"💾 Cached: {cache_key}")
    except Exception as e:
        print(f"Cache write error: {e}")


def get_whisper_model():
    """Lazy load the faster-whisper model"""
    global _whisper_model
    if _whisper_model is None:
        try:
            from faster_whisper import WhisperModel
            # Use tiny.en for fastest performance (~75MB, English only)
            model_size = os.getenv('WHISPER_MODEL', 'tiny.en')
            device = os.getenv('WHISPER_DEVICE', 'cpu')
            compute_type = os.getenv('WHISPER_COMPUTE', 'int8')
            
            print(f"🎤 Loading Whisper model: {model_size} on {device}")
            _whisper_model = WhisperModel(model_size, device=device, compute_type=compute_type)
            print(f"✅ Whisper model loaded successfully")
        except Exception as e:
            print(f"❌ Failed to load Whisper model: {e}")
            return None
    return _whisper_model


def transcribe_audio(audio_data: bytes, use_cache: bool = True):
    """Core transcription function with caching"""
    # Check cache first
    if use_cache:
        cached = get_cached_transcription(audio_data)
        if cached:
            cached['from_cache'] = True
            return cached
    
    model = get_whisper_model()
    if model is None:
        return {'error': 'Whisper model not available'}
    
    try:
        # Write to temp file
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as f:
            f.write(audio_data)
            temp_path = f.name
        
        # Transcribe
        segments, info = model.transcribe(
            temp_path,
            beam_size=1,
            language='en',
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )
        
        text_parts = [segment.text for segment in segments]
        full_text = ' '.join(text_parts).strip()
        
        # Cleanup temp file
        os.unlink(temp_path)
        
        result = {
            'text': full_text,
            'language': info.language,
            'duration': info.duration,
            'success': True,
            'from_cache': False
        }
        
        # Cache the result if text is meaningful
        if use_cache and full_text and len(full_text) > 2:
            cache_transcription(audio_data, result)
        
        return result
        
    except Exception as e:
        if 'temp_path' in locals():
            try:
                os.unlink(temp_path)
            except:
                pass
        return {'error': str(e)}


@stt_bp.route('/transcribe', methods=['POST'])
def transcribe():
    """
    Transcribe audio chunk to text
    Accepts: 
        - audio file upload (multipart/form-data)
        - base64 encoded audio (JSON body)
    Returns: { "text": "transcribed text", "language": "en", "duration": 1.5 }
    """
    audio_data = None
    
    # Handle file upload
    if 'audio' in request.files:
        audio_file = request.files['audio']
        audio_data = audio_file.read()
    
    # Handle base64 JSON body
    elif request.is_json:
        data = request.get_json()
        if 'audio' in data:
            try:
                audio_b64 = data['audio']
                if ',' in audio_b64:
                    audio_b64 = audio_b64.split(',')[1]
                audio_data = base64.b64decode(audio_b64)
            except Exception as e:
                return jsonify({'error': f'Invalid base64 audio: {str(e)}'}), 400
    
    if not audio_data:
        return jsonify({'error': 'No audio data provided'}), 400
    
    result = transcribe_audio(audio_data)
    
    if 'error' in result:
        return jsonify(result), 500 if 'model' in result.get('error', '') else 400
    
    return jsonify(result)


@stt_bp.route('/health', methods=['GET'])
def health():
    """Check if STT service is ready"""
    model = get_whisper_model()
    redis = get_redis_client()
    
    return jsonify({
        'status': 'ready' if model else 'unavailable',
        'model': os.getenv('WHISPER_MODEL', 'tiny.en'),
        'cache': 'enabled' if redis else 'disabled'
    })


@stt_bp.route('/cache/clear', methods=['POST'])
def clear_cache():
    """Clear all STT cache entries"""
    redis = get_redis_client()
    if not redis:
        return jsonify({'error': 'Cache not available'}), 503
    
    try:
        # Delete all stt: prefixed keys
        cursor = 0
        deleted = 0
        while True:
            cursor, keys = redis.scan(cursor, match='stt:*', count=100)
            if keys:
                redis.delete(*keys)
                deleted += len(keys)
            if cursor == 0:
                break
        return jsonify({'cleared': deleted})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Socket.IO event handlers (registered in app.py)
def register_socketio_handlers(socketio):
    """Register Socket.IO events for real-time streaming"""
    
    @socketio.on('transcribe_chunk')
    def handle_audio_chunk(data):
        """Handle incoming audio chunk for real-time transcription"""
        try:
            audio_b64 = data.get('audio', '')
            if ',' in audio_b64:
                audio_b64 = audio_b64.split(',')[1]
            audio_data = base64.b64decode(audio_b64)
            
            result = transcribe_audio(audio_data)
            
            if 'error' in result:
                emit('transcription_error', {'error': result['error']})
            else:
                emit('transcription_result', {
                    'text': result.get('text', ''),
                    'is_final': data.get('is_final', False),
                    'chunk_id': data.get('chunk_id', 0),
                    'from_cache': result.get('from_cache', False)
                })
            
        except Exception as e:
            emit('transcription_error', {'error': str(e)})
    
    @socketio.on('stt_ping')
    def handle_ping():
        """Handle ping for latency measurement"""
        import time
        emit('stt_pong', {'timestamp': time.time() * 1000})
