"""
Presentations Routes
Handles Google Slides integration with MongoDB and Redis caching
"""
from flask import Blueprint, request, session, jsonify, current_app
from bson import ObjectId
from services.google_auth import google_auth_service
from services.slides_service import get_slides_service
from services.drive_service import get_drive_service
from services.cache_service import cache_service
from datetime import datetime
from functools import wraps

presentations_bp = Blueprint('presentations', __name__, url_prefix='/presentations')


def get_db():
    """Get MongoDB database instance"""
    return current_app.extensions.get('mongo_db')


def require_auth(f):
    """Decorator to require authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Authentication required'}), 401
        
        db = get_db()
        if db is None:
            return jsonify({'error': 'Database not available'}), 500
            
        user = db.users.find_one({'_id': ObjectId(user_id)})
        
        if not user:
            return jsonify({'error': 'User not found'}), 401
        
        # Get valid credentials
        credentials = google_auth_service.get_valid_credentials_from_doc(user, db)
        if not credentials:
            return jsonify({'error': 'Invalid credentials, please re-authenticate'}), 401
        
        return f(user, credentials, *args, **kwargs)
    return decorated_function


@presentations_bp.route('/')
@require_auth
def list_presentations(user, credentials):
    """List user's Google Slides presentations (fresh from Google - thumbnails expire)"""
    try:
        drive_service = get_drive_service(credentials)
        presentations = drive_service.list_presentations()
        
        return jsonify({
            'presentations': presentations,
            'cached': False
        })
    except Exception as e:
        print(f"Error listing presentations: {e}")
        return jsonify({'error': 'Failed to list presentations'}), 500


@presentations_bp.route('/<presentation_id>')
@require_auth
def get_presentation(user, credentials, presentation_id):
    """Get full presentation data (with cache)"""
    user_id = str(user['_id'])
    
    # Try cache first
    cached = cache_service.get_presentation(presentation_id, user_id)
    if cached:
        return jsonify({**cached, 'cached': True})
    
    try:
        slides_service = get_slides_service(credentials)
        presentation = slides_service.get_presentation(presentation_id)
        
        # Cache the presentation (1 hour TTL)
        cache_service.set_presentation(presentation_id, user_id, presentation)
        
        return jsonify({**presentation, 'cached': False})
    except Exception as e:
        print(f"Error getting presentation: {e}")
        return jsonify({'error': 'Failed to get presentation'}), 500


@presentations_bp.route('/<presentation_id>/thumbnails')
@require_auth
def get_thumbnails(user, credentials, presentation_id):
    """Get slide thumbnails"""
    try:
        slides_service = get_slides_service(credentials)
        thumbnails = slides_service.get_slide_thumbnails(presentation_id)
        
        return jsonify({
            'thumbnails': thumbnails
        })
    except Exception as e:
        print(f"Error getting thumbnails: {e}")
        return jsonify({'error': 'Failed to get thumbnails'}), 500


@presentations_bp.route('/<presentation_id>/refresh', methods=['POST'])
@require_auth
def refresh_presentation(user, credentials, presentation_id):
    """Force refresh presentation from Google (invalidate cache)"""
    user_id = str(user['_id'])
    
    # Invalidate cache
    cache_service.invalidate_presentation(presentation_id, user_id)
    
    try:
        slides_service = get_slides_service(credentials)
        presentation = slides_service.get_presentation(presentation_id)
        
        # Re-cache
        cache_service.set_presentation(presentation_id, user_id, presentation)
        
        return jsonify({**presentation, 'refreshed': True})
    except Exception as e:
        print(f"Error refreshing presentation: {e}")
        return jsonify({'error': 'Failed to refresh presentation'}), 500


@presentations_bp.route('/<presentation_id>/feedback', methods=['POST'])
@require_auth
def write_feedback(user, credentials, presentation_id):
    """Write feedback to speaker notes"""
    data = request.get_json()
    
    slide_id = data.get('slideId')
    feedback = data.get('feedback')
    
    if not slide_id or not feedback:
        return jsonify({'error': 'slideId and feedback are required'}), 400
    
    try:
        slides_service = get_slides_service(credentials)
        success = slides_service.update_speaker_notes(presentation_id, slide_id, feedback)
        
        if success:
            # Invalidate cache since presentation was modified
            cache_service.invalidate_presentation(presentation_id, str(user['_id']))
            return jsonify({'success': True, 'message': 'Feedback added to speaker notes'})
        else:
            return jsonify({'error': 'Failed to update speaker notes'}), 500
    except Exception as e:
        print(f"Error writing feedback: {e}")
        return jsonify({'error': 'Failed to write feedback'}), 500


@presentations_bp.route('/cache/clear', methods=['POST'])
@require_auth
def clear_cache(user, credentials):
    """Clear all cached presentations for user"""
    user_id = str(user['_id'])
    cache_service.clear_user_cache(user_id)
    return jsonify({'success': True, 'message': 'Cache cleared'})
