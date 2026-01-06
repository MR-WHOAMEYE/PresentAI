"""
Google Authentication Service
Handles OAuth 2.0 flow and token management
"""
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from datetime import datetime

from flask import current_app

class GoogleAuthService:
    """Handles Google OAuth 2.0 authentication"""
    
    def _get_client_config(self):
        """Get Google OAuth client configuration from app config"""
        return {
            "web": {
                "client_id": current_app.config.get('GOOGLE_CLIENT_ID'),
                "client_secret": current_app.config.get('GOOGLE_CLIENT_SECRET'),
                "redirect_uris": [current_app.config.get('GOOGLE_REDIRECT_URI', 'http://localhost:5000/auth/callback')],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token"
            }
        }
    
    def get_authorization_url(self, state=None):
        """Generate OAuth authorization URL"""
        client_config = self._get_client_config()
        redirect_uri = current_app.config.get('GOOGLE_REDIRECT_URI', 'http://localhost:5000/auth/callback')
        
        flow = Flow.from_client_config(
            client_config,
            scopes=current_app.config.get('GOOGLE_SCOPES'),
            redirect_uri=redirect_uri
        )
        
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent',
            state=state
        )
        
        return authorization_url, state
    
    def exchange_code_for_tokens(self, code):
        """Exchange authorization code for tokens"""
        client_config = self._get_client_config()
        redirect_uri = current_app.config.get('GOOGLE_REDIRECT_URI', 'http://localhost:5000/auth/callback')
        
        flow = Flow.from_client_config(
            client_config,
            scopes=current_app.config.get('GOOGLE_SCOPES'),
            redirect_uri=redirect_uri
        )
        
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        return {
            'access_token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_expiry': credentials.expiry
        }
    
    def get_user_info(self, access_token):
        """Get user info from Google"""
        credentials = Credentials(token=access_token)
        service = build('oauth2', 'v2', credentials=credentials)
        user_info = service.userinfo().get().execute()
        
        return {
            'google_id': user_info.get('id'),
            'email': user_info.get('email'),
            'name': user_info.get('name'),
            'picture': user_info.get('picture')
        }
    
    def refresh_access_token(self, refresh_token):
        """Refresh expired access token"""
        credentials = Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=current_app.config.get('GOOGLE_CLIENT_ID'),
            client_secret=current_app.config.get('GOOGLE_CLIENT_SECRET')
        )
        
        credentials.refresh(Request())
        
        return {
            'access_token': credentials.token,
            'token_expiry': credentials.expiry
        }
    
    def get_valid_credentials_from_doc(self, user_doc, db):
        """Get valid credentials for a user document, refreshing if needed"""
        from bson import ObjectId
        
        # Check if token is expired
        token_expiry = user_doc.get('token_expiry')
        if token_expiry and token_expiry <= datetime.utcnow():
            # Refresh the token
            refresh_token = user_doc.get('refresh_token')
            if refresh_token:
                try:
                    new_tokens = self.refresh_access_token(refresh_token)
                    db.users.update_one(
                        {'_id': user_doc['_id']},
                        {'$set': {
                            'access_token': new_tokens['access_token'],
                            'token_expiry': new_tokens['token_expiry']
                        }}
                    )
                    user_doc['access_token'] = new_tokens['access_token']
                except Exception as e:
                    print(f"Error refreshing token: {e}")
                    return None
        
        return Credentials(
            token=user_doc.get('access_token'),
            refresh_token=user_doc.get('refresh_token'),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=current_app.config.get('GOOGLE_CLIENT_ID'),
            client_secret=current_app.config.get('GOOGLE_CLIENT_SECRET')
        )


google_auth_service = GoogleAuthService()
