"""
Authentication Routes
Handles Firebase Auth + Google OAuth for Slides/Drive
"""
from flask import Blueprint, request, redirect, session, jsonify, current_app
from bson import ObjectId
from models import User
from services.google_auth import google_auth_service
from config import Config
from datetime import datetime
import secrets
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

# Initialize Firebase Admin (will be done once)
_firebase_initialized = False

def init_firebase():
    """Initialize Firebase Admin SDK"""
    global _firebase_initialized
    if _firebase_initialized:
        return
    
    try:
        # Try to use service account from environment or default credentials
        if not firebase_admin._apps:
            # Use default credentials (Application Default Credentials)
            firebase_admin.initialize_app()
        _firebase_initialized = True
    except Exception as e:
        print(f"Firebase Admin initialization note: {e}")
        # Firebase will use project ID from environment for verification
        _firebase_initialized = True


def get_db():
    """Get MongoDB database instance"""
    return current_app.extensions.get('mongo_db')


def verify_firebase_token(id_token):
    """Verify Firebase ID token"""
    try:
        init_firebase()
        decoded_token = firebase_auth.verify_id_token(id_token)
        return decoded_token
    except Exception as e:
        print(f"Firebase token verification failed: {e}")
        return None


def get_firebase_user_from_request():
    """Extract and verify Firebase user from Authorization header"""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header.split('Bearer ')[1]
    return verify_firebase_token(token)


@auth_bp.route('/firebase-sync', methods=['POST'])
def firebase_sync():
    """
    Sync Firebase user with MongoDB
    Called after Firebase login to create/update user in our database
    """
    data = request.get_json() or {}
    
    # Verify Firebase token
    firebase_user = get_firebase_user_from_request()
    if not firebase_user:
        # For development, allow without verification
        firebase_user = {
            'uid': data.get('uid'),
            'email': data.get('email'),
            'name': data.get('name'),
            'picture': data.get('picture')
        }
    
    uid = firebase_user.get('uid') or data.get('uid')
    email = firebase_user.get('email') or data.get('email')
    
    if not uid or not email:
        return jsonify({'error': 'Missing user data'}), 400
    
    db = get_db()
    if db is None:
        return jsonify({'error': 'Database not available'}), 500
    
    # Find existing user by Firebase UID or email
    existing_user = db.users.find_one({
        '$or': [
            {'firebase_uid': uid},
            {'email': email}
        ]
    })
    
    if existing_user:
        # Update existing user with Firebase UID
        db.users.update_one(
            {'_id': existing_user['_id']},
            {'$set': {
                'firebase_uid': uid,
                'name': data.get('name') or existing_user.get('name'),
                'picture': data.get('picture') or existing_user.get('picture'),
                'updated_at': datetime.utcnow()
            }}
        )
        user_id = str(existing_user['_id'])
        has_google_token = bool(existing_user.get('access_token'))
    else:
        # Create new user
        new_user = {
            'firebase_uid': uid,
            'email': email,
            'name': data.get('name'),
            'picture': data.get('picture'),
            'google_id': None,
            'access_token': None,
            'refresh_token': None,
            'token_expiry': None,
            'preferences': {
                'eyeContact': True,
                'fillerWords': True,
                'posture': True,
                'sensitivity': 80,
                'feedbackTiming': 'post',
                'voiceEnabled': False,
                'voiceId': 'Rachel',
                'voiceSpeed': 1.0,
                'presentationStyle': 'Professional & Corporate'
            },
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        result = db.users.insert_one(new_user)
        user_id = str(result.inserted_id)
        has_google_token = False
    
    # Store user ID in session
    session['user_id'] = user_id
    session['firebase_uid'] = uid
    
    # Get updated user
    user_doc = db.users.find_one({'_id': ObjectId(user_id)})
    
    return jsonify({
        'success': True,
        'user': User.to_dict(user_doc) if user_doc else None,
        'hasGoogleToken': has_google_token
    })


@auth_bp.route('/google-drive')
def google_drive_connect():
    """
    Initiate Google OAuth for Slides/Drive access
    This is SEPARATE from Firebase login - used to get Drive/Slides permissions
    """
    # Generate state token
    state = secrets.token_urlsafe(32)
    session['oauth_state'] = state
    
    # Store return URL
    return_url = request.args.get('return_url', current_app.config.get('FRONTEND_URL'))
    session['oauth_return_url'] = return_url
    
    authorization_url, _ = google_auth_service.get_authorization_url(state=state)
    return redirect(authorization_url)


@auth_bp.route('/google')
def google_login():
    """
    Legacy Google OAuth flow - redirects to google-drive for backwards compatibility
    """
    state = secrets.token_urlsafe(32)
    session['oauth_state'] = state
    
    authorization_url, _ = google_auth_service.get_authorization_url(state=state)
    return redirect(authorization_url)


@auth_bp.route('/callback')
def google_callback():
    """Handle OAuth callback from Google (for Drive/Slides access)"""
    state = request.args.get('state')
    stored_state = session.get('oauth_state')
    if stored_state and state != stored_state:
        print(f"Warning: State mismatch - received: {state}, stored: {stored_state}")
    
    error = request.args.get('error')
    if error:
        return redirect(f"{current_app.config.get('FRONTEND_URL')}?error={error}")
    
    code = request.args.get('code')
    if not code:
        return jsonify({'error': 'No authorization code'}), 400
    
    try:
        tokens = google_auth_service.exchange_code_for_tokens(code)
        user_info = google_auth_service.get_user_info(tokens['access_token'])
        
        db = get_db()
        
        # Check if we have a Firebase user in session
        firebase_uid = session.get('firebase_uid')
        user_id = session.get('user_id')
        
        if user_id:
            # Update existing user with Google tokens
            db.users.update_one(
                {'_id': ObjectId(user_id)},
                {'$set': {
                    'google_id': user_info['google_id'],
                    'access_token': tokens['access_token'],
                    'refresh_token': tokens.get('refresh_token'),
                    'token_expiry': tokens.get('token_expiry'),
                    'updated_at': datetime.utcnow()
                }}
            )
        else:
            # Legacy flow: Find or create user by Google ID
            existing_user = db.users.find_one({'google_id': user_info['google_id']})
            
            if existing_user:
                db.users.update_one(
                    {'_id': existing_user['_id']},
                    {'$set': {
                        'access_token': tokens['access_token'],
                        'refresh_token': tokens.get('refresh_token') or existing_user.get('refresh_token'),
                        'token_expiry': tokens.get('token_expiry'),
                        'name': user_info.get('name'),
                        'picture': user_info.get('picture'),
                        'updated_at': datetime.utcnow()
                    }}
                )
                user_id = str(existing_user['_id'])
            else:
                new_user = User.create_document(
                    google_id=user_info['google_id'],
                    email=user_info['email'],
                    name=user_info.get('name'),
                    picture=user_info.get('picture'),
                    access_token=tokens['access_token'],
                    refresh_token=tokens.get('refresh_token'),
                    token_expiry=tokens.get('token_expiry')
                )
                result = db.users.insert_one(new_user)
                user_id = str(result.inserted_id)
        
        session['user_id'] = user_id
        
        # Redirect back to frontend
        return_url = session.pop('oauth_return_url', current_app.config.get('FRONTEND_URL'))
        return redirect(f"{return_url}?google_connected=true")
        
    except Exception as e:
        print(f"OAuth error: {e}")
        return redirect(f"{current_app.config.get('FRONTEND_URL')}?error=auth_failed")


@auth_bp.route('/status')
def auth_status():
    """Check authentication status"""
    user_id = session.get('user_id')
    
    if not user_id:
        return jsonify({
            'authenticated': False,
            'user': None
        })
    
    db = get_db()
    if db is None:
        return jsonify({
            'authenticated': False,
            'user': None
        })
    
    user = db.users.find_one({'_id': ObjectId(user_id)})
    
    if not user:
        session.pop('user_id', None)
        return jsonify({
            'authenticated': False,
            'user': None
        })
    
    return jsonify({
        'authenticated': True,
        'user': User.to_dict(user),
        'hasGoogleToken': bool(user.get('access_token'))
    })


@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Clear session and logout"""
    session.clear()
    return jsonify({'success': True})


@auth_bp.route('/refresh', methods=['POST'])
def refresh_token():
    """Refresh access token"""
    user_id = session.get('user_id')
    
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    db = get_db()
    user = db.users.find_one({'_id': ObjectId(user_id)})
    
    if not user or not user.get('refresh_token'):
        return jsonify({'error': 'Cannot refresh token'}), 400
    
    try:
        new_tokens = google_auth_service.refresh_access_token(user['refresh_token'])
        db.users.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {
                'access_token': new_tokens['access_token'],
                'token_expiry': new_tokens['token_expiry'],
                'updated_at': datetime.utcnow()
            }}
        )
        
        return jsonify({'success': True})
    except Exception as e:
        print(f"Token refresh error: {e}")
        return jsonify({'error': 'Failed to refresh token'}), 500


@auth_bp.route('/preferences', methods=['GET', 'POST'])
def handle_preferences():
    """Get or update user preferences"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    db = get_db()
    if request.method == 'POST':
        data = request.get_json() or {}
        db.users.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {'preferences': data, 'updated_at': datetime.utcnow()}}
        )
        return jsonify({'success': True})
    
    user = db.users.find_one({'_id': ObjectId(user_id)})
    return jsonify(user.get('preferences', {}))


@auth_bp.route('/google-drive/status')
def google_drive_status():
    """Check if user has connected Google Drive/Slides"""
    user_id = session.get('user_id')
    
    if not user_id:
        return jsonify({'connected': False})
    
    db = get_db()
    user = db.users.find_one({'_id': ObjectId(user_id)})
    
    if not user:
        return jsonify({'connected': False})
    
    return jsonify({
        'connected': bool(user.get('access_token')),
        'email': user.get('email')
    })
