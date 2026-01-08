"""
MongoDB Models
Document schemas for Users and Practice Sessions
"""
from datetime import datetime
from bson import ObjectId


class User:
    """User document model"""
    
    collection_name = 'users'
    
    @staticmethod
    def create_document(google_id, email, name=None, picture=None, 
                       access_token=None, refresh_token=None, token_expiry=None):
        """Create a new user document"""
        return {
            'google_id': google_id,
            'email': email,
            'name': name,
            'picture': picture,
            'access_token': access_token,
            'refresh_token': refresh_token,
            'token_expiry': token_expiry,
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
    
    @staticmethod
    def to_dict(doc):
        """Convert MongoDB document to API response"""
        if not doc:
            return None
        return {
            'id': str(doc['_id']),
            'email': doc.get('email'),
            'name': doc.get('name'),
            'picture': doc.get('picture'),
            'preferences': doc.get('preferences', {}),
            'hasGoogleToken': bool(doc.get('access_token'))
        }


class PracticeSession:
    """Practice session document model"""
    
    collection_name = 'practice_sessions'
    
    @staticmethod
    def create_document(user_id, presentation_id=None, presentation_title=None):
        """Create a new practice session document"""
        return {
            'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id,
            'presentation_id': presentation_id,
            'presentation_title': presentation_title,
            'started_at': datetime.utcnow(),
            'ended_at': None,
            'duration_seconds': None,
            'metrics': {},
            'ai_summary': None,
            'overall_score': None,
            'recording_path': None,
            'created_at': datetime.utcnow()
        }
    
    @staticmethod
    def to_dict(doc):
        """Convert MongoDB document to API response"""
        if not doc:
            return None
        return {
            'id': str(doc['_id']),
            'presentationId': doc.get('presentation_id'),
            'presentationTitle': doc.get('presentation_title'),
            'startedAt': doc.get('started_at').isoformat() if doc.get('started_at') else None,
            'endedAt': doc.get('ended_at').isoformat() if doc.get('ended_at') else None,
            'createdAt': doc.get('created_at').isoformat() if doc.get('created_at') else None,
            'durationSeconds': doc.get('duration_seconds'),
            'metrics': doc.get('metrics', {}),
            'aiSummary': doc.get('ai_summary'),
            'aiFeedback': doc.get('ai_feedback'),
            'overallScore': doc.get('overall_score'),
            'transcript': doc.get('transcript'),
            'hasRecording': bool(doc.get('recording_url') or doc.get('recording_path')),
            'recordingUrl': doc.get('recording_url'),
            'recordingPlayerUrl': doc.get('recording_player_url'),
            'recordingThumbnail': doc.get('recording_thumbnail')
        }
