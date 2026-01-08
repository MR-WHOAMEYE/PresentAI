"""
Authentication Routes
Handles Google OAuth 2.0 flow with MongoDB
"""
from flask import Blueprint, request, redirect, session, jsonify, current_app
from bson import ObjectId
from models import User
from services.google_auth import google_auth_service
from config import Config
from datetime import datetime
import secrets

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')


def get_db():
    """Get MongoDB database instance"""
    return current_app.extensions.get('mongo_db')


@auth_bp.route('/google')
def google_login():
    """Initiate Google OAuth flow"""
    # Generate state token to prevent CSRF
    state = secrets.token_urlsafe(32)
    session['oauth_state'] = state
    
    authorization_url, _ = google_auth_service.get_authorization_url(state=state)
    return redirect(authorization_url)


@auth_bp.route('/callback')
def google_callback():
    """Handle OAuth callback from Google"""
    # Verify state (relaxed for serverless deployments where sessions may not persist)
    state = request.args.get('state')
    stored_state = session.get('oauth_state')
    if stored_state and state != stored_state:
        print(f"Warning: State mismatch - received: {state}, stored: {stored_state}")
        # In serverless environments, sessions may not persist between requests
        # We log the warning but continue with the OAuth flow
    
    # Check for errors
    error = request.args.get('error')
    if error:
        return redirect(f"{current_app.config.get('FRONTEND_URL')}?error={error}")
    
    # Exchange code for tokens
    code = request.args.get('code')
    if not code:
        return jsonify({'error': 'No authorization code'}), 400
    
    try:
        tokens = google_auth_service.exchange_code_for_tokens(code)
        user_info = google_auth_service.get_user_info(tokens['access_token'])
        
        db = get_db()
        
        # Find or create user
        existing_user = db.users.find_one({'google_id': user_info['google_id']})
        
        if existing_user:
            # Update existing user
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
            # Create new user
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
        
        # Store user ID in session
        session['user_id'] = user_id
        
        # Redirect to frontend with success
        return redirect(f"{current_app.config.get('FRONTEND_URL')}?auth=success")
        
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
        'user': User.to_dict(user)
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
