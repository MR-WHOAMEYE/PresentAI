"""
Sessions Routes
Handles practice session management with MongoDB
"""
from flask import Blueprint, request, session, jsonify, current_app
from bson import ObjectId
from models import PracticeSession
from services.google_auth import google_auth_service
from services.drive_service import get_drive_service
from datetime import datetime
from functools import wraps

sessions_bp = Blueprint('sessions', __name__, url_prefix='/sessions')


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
        
        return f(user, *args, **kwargs)
    return decorated_function


@sessions_bp.route('/')
@require_auth
def list_sessions(user):
    """List all practice sessions for user"""
    db = get_db()
    sessions_cursor = db.practice_sessions.find(
        {'user_id': user['_id']}
    ).sort('created_at', -1)
    
    sessions = [PracticeSession.to_dict(s) for s in sessions_cursor]
    
    return jsonify({
        'sessions': sessions
    })


@sessions_bp.route('/', methods=['POST'])
@require_auth
def create_session(user):
    """Create a new practice session"""
    data = request.get_json() or {}
    
    db = get_db()
    
    new_session = PracticeSession.create_document(
        user_id=user['_id'],
        presentation_id=data.get('presentationId'),
        presentation_title=data.get('presentationTitle')
    )
    
    result = db.practice_sessions.insert_one(new_session)
    new_session['_id'] = result.inserted_id
    
    return jsonify({
        'session': PracticeSession.to_dict(new_session)
    }), 201


@sessions_bp.route('/<session_id>')
@require_auth
def get_session(user, session_id):
    """Get session details"""
    db = get_db()
    
    practice_session = db.practice_sessions.find_one({
        '_id': ObjectId(session_id),
        'user_id': user['_id']
    })
    
    if not practice_session:
        return jsonify({'error': 'Session not found'}), 404
    
    return jsonify({
        'session': PracticeSession.to_dict(practice_session)
    })


@sessions_bp.route('/<session_id>', methods=['PUT'])
@require_auth
def update_session(user, session_id):
    """Update session with metrics"""
    db = get_db()
    
    practice_session = db.practice_sessions.find_one({
        '_id': ObjectId(session_id),
        'user_id': user['_id']
    })
    
    if not practice_session:
        return jsonify({'error': 'Session not found'}), 404
    
    data = request.get_json()
    
    update_fields = {}
    if 'metrics' in data:
        update_fields['metrics'] = data['metrics']
    if 'aiSummary' in data:
        update_fields['ai_summary'] = data['aiSummary']
    if 'overallScore' in data:
        update_fields['overall_score'] = data['overallScore']
    
    if update_fields:
        db.practice_sessions.update_one(
            {'_id': ObjectId(session_id)},
            {'$set': update_fields}
        )
    
    updated_session = db.practice_sessions.find_one({'_id': ObjectId(session_id)})
    
    return jsonify({
        'session': PracticeSession.to_dict(updated_session)
    })


@sessions_bp.route('/<session_id>/complete', methods=['POST'])
@require_auth
def complete_session(user, session_id):
    """Complete a practice session"""
    db = get_db()
    
    practice_session = db.practice_sessions.find_one({
        '_id': ObjectId(session_id),
        'user_id': user['_id']
    })
    
    if not practice_session:
        return jsonify({'error': 'Session not found'}), 404
    
    data = request.get_json() or {}
    
    ended_at = datetime.utcnow()
    duration_seconds = None
    
    if practice_session.get('started_at'):
        duration = ended_at - practice_session['started_at']
        duration_seconds = int(duration.total_seconds())
    
    update_fields = {
        'ended_at': ended_at,
        'duration_seconds': duration_seconds
    }
    
    if 'metrics' in data:
        update_fields['metrics'] = data['metrics']
    if 'aiSummary' in data:
        update_fields['ai_summary'] = data['aiSummary']
    if 'aiFeedback' in data:
        update_fields['ai_feedback'] = data['aiFeedback']
    if 'overallScore' in data:
        update_fields['overall_score'] = data['overallScore']
    if 'transcript' in data:
        update_fields['transcript'] = data['transcript']
    
    db.practice_sessions.update_one(
        {'_id': ObjectId(session_id)},
        {'$set': update_fields}
    )
    
    updated_session = db.practice_sessions.find_one({'_id': ObjectId(session_id)})
    
    return jsonify({
        'session': PracticeSession.to_dict(updated_session)
    })


@sessions_bp.route('/<session_id>', methods=['DELETE'])
@require_auth
def delete_session(user, session_id):
    """Delete a practice session"""
    db = get_db()
    
    result = db.practice_sessions.delete_one({
        '_id': ObjectId(session_id),
        'user_id': user['_id']
    })
    
    if result.deleted_count == 0:
        return jsonify({'error': 'Session not found'}), 404
    
    return jsonify({'success': True})


@sessions_bp.route('/stats')
@require_auth
def get_stats(user):
    """Get user's practice statistics"""
    db = get_db()
    
    sessions = list(db.practice_sessions.find({'user_id': user['_id']}))
    
    if not sessions:
        return jsonify({
            'totalSessions': 0,
            'totalPracticeTime': 0,
            'averageScore': 0,
            'recentTrend': 'neutral'
        })
    
    total_sessions = len(sessions)
    total_time = sum(s.get('duration_seconds') or 0 for s in sessions)
    scores = [s.get('overall_score') for s in sessions if s.get('overall_score') is not None]
    avg_score = sum(scores) / len(scores) if scores else 0
    
    # Calculate trend based on last 5 sessions
    recent_sessions = sorted(sessions, key=lambda x: x.get('created_at', datetime.min), reverse=True)[:5]
    recent_scores = [s.get('overall_score') for s in recent_sessions if s.get('overall_score') is not None]
    
    trend = 'neutral'
    if len(recent_scores) >= 2:
        if recent_scores[0] > recent_scores[-1]:
            trend = 'improving'
        elif recent_scores[0] < recent_scores[-1]:
            trend = 'declining'
    
    return jsonify({
        'totalSessions': total_sessions,
        'totalPracticeTime': total_time,
        'averageScore': round(avg_score, 1),
        'recentTrend': trend
    })


@sessions_bp.route('/trends')
@require_auth
def get_trends(user):
    """Get historical trends comparing recent sessions with natural language insights"""
    db = get_db()
    
    sessions = list(db.practice_sessions.find(
        {'user_id': user['_id']}
    ).sort('created_at', -1).limit(10))
    
    if len(sessions) < 2:
        return jsonify({
            'hasTrends': False,
            'message': 'Complete at least 2 sessions to see trends',
            'insights': []
        })
    
    # Get metrics from sessions
    current = sessions[0]
    previous = sessions[1]
    all_scores = [s.get('overall_score', 0) for s in sessions if s.get('overall_score')]
    
    insights = []
    
    # Eye contact trend
    curr_eye = current.get('metrics', {}).get('eyeContactPercent', 0)
    prev_eye = previous.get('metrics', {}).get('eyeContactPercent', 0)
    if curr_eye and prev_eye:
        diff = curr_eye - prev_eye
        if diff > 5:
            insights.append(f"Your eye contact improved by {diff:.0f}% compared to last session!")
        elif diff < -5:
            insights.append(f"Your eye contact dropped {abs(diff):.0f}% since last time - try focusing on the camera")
        else:
            insights.append(f"You maintained consistent eye contact ({curr_eye:.0f}%) across sessions")
    
    # Posture trend
    curr_posture = current.get('metrics', {}).get('postureScore', 0)
    prev_posture = previous.get('metrics', {}).get('postureScore', 0)
    if curr_posture and prev_posture:
        diff = curr_posture - prev_posture
        if diff > 5:
            insights.append(f"Great posture improvement! Up {diff:.0f}% from last session")
        elif diff < -5:
            insights.append(f"Posture was slightly lower this time ({abs(diff):.0f}% change)")
    
    # Filler words trend
    curr_fillers = current.get('metrics', {}).get('fillerCount', 0)
    prev_fillers = previous.get('metrics', {}).get('fillerCount', 0)
    if prev_fillers > 0:
        filler_change = ((curr_fillers - prev_fillers) / prev_fillers) * 100
        if filler_change < -20:
            insights.append(f"Excellent! You reduced filler words by {abs(filler_change):.0f}%")
        elif filler_change > 20:
            insights.append(f"Filler words increased by {filler_change:.0f}% - take a breath before speaking")
    
    # Overall trend
    if len(all_scores) >= 3:
        first_third = sum(all_scores[-3:]) / 3
        last_third = sum(all_scores[:3]) / 3
        if last_third > first_third + 5:
            insights.append("You're on an upward trend! Keep up the great work!")
        elif last_third < first_third - 5:
            insights.append("Your scores have dipped recently - consider reviewing feedback from earlier sessions")
    
    # Session comparison
    comparison = {
        'previousScore': previous.get('overall_score', 0),
        'currentScore': current.get('overall_score', 0),
        'improvement': (current.get('overall_score', 0) or 0) - (previous.get('overall_score', 0) or 0),
        'totalSessions': len(sessions),
        'averageScore': sum(all_scores) / len(all_scores) if all_scores else 0
    }
    
    return jsonify({
        'hasTrends': True,
        'insights': insights,
        'comparison': comparison,
        'recentSessions': [{
            'id': str(s['_id']),
            'date': s.get('created_at', '').isoformat() if s.get('created_at') else None,
            'score': s.get('overall_score', 0),
            'duration': s.get('duration_seconds', 0)
        } for s in sessions[:5]]
    })


@sessions_bp.route('/<session_id>/upload-recording', methods=['POST'])
@require_auth
def upload_recording(user, session_id):
    """Upload session recording to Vercel Blob (or Cloudinary fallback)"""
    from services.vercel_blob_service import vercel_blob_service
    from services.cloudinary_service import cloudinary_service
    
    db = get_db()
    
    # Get session
    practice_session = db.practice_sessions.find_one({
        '_id': ObjectId(session_id),
        'user_id': user['_id']
    })
    
    if not practice_session:
        return jsonify({'error': 'Session not found'}), 404
    
    # Check if file was uploaded
    if 'recording' not in request.files:
        return jsonify({'error': 'No recording file provided'}), 400
    
    file = request.files['recording']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    try:
        # Try Vercel Blob first, then fall back to Cloudinary
        if vercel_blob_service.configured:
            result = vercel_blob_service.upload_video_multipart(
                video_file=file,
                filename=f"session_{session_id}.webm",
                session_id=session_id,
                user_id=str(user['_id'])
            )
            storage_type = 'vercel_blob'
        else:
            # Fallback to Cloudinary
            result = cloudinary_service.upload_video_chunked(
                video_file=file,
                session_id=session_id,
                user_id=str(user['_id'])
            )
            storage_type = 'cloudinary'
        
        if 'error' in result:
            return jsonify({'error': result['error']}), 500
        
        # Update session with video data
        update_data = {
            'recording_url': result.get('url'),
            'recording_storage': storage_type
        }
        
        # Add Cloudinary-specific fields
        if storage_type == 'cloudinary':
            update_data['recording_public_id'] = result.get('public_id')
            update_data['recording_player_url'] = result.get('player_url')
            update_data['recording_thumbnail'] = result.get('thumbnail_url')
        
        db.practice_sessions.update_one(
            {'_id': ObjectId(session_id)},
            {'$set': update_data}
        )
        
        return jsonify({
            'success': True,
            'storage': storage_type,
            'recording': {
                'url': result.get('url'),
                'playerUrl': result.get('player_url') if storage_type == 'cloudinary' else result.get('url'),
                'size': result.get('size')
            }
        })
        
    except Exception as e:
        print(f"Error uploading recording: {e}")
        return jsonify({'error': 'Failed to upload recording'}), 500


# Temporary storage for chunks (in production, use Redis or similar)
_chunk_storage = {}

@sessions_bp.route('/<session_id>/upload-chunk', methods=['POST'])
@require_auth
def upload_chunk(user, session_id):
    """Upload a video chunk for a session"""
    import tempfile
    import os
    from services.cloudinary_service import cloudinary_service
    
    db = get_db()
    
    # Get session
    practice_session = db.practice_sessions.find_one({
        '_id': ObjectId(session_id),
        'user_id': user['_id']
    })
    
    if not practice_session:
        return jsonify({'error': 'Session not found'}), 404
    
    # Get chunk data
    if 'chunk' not in request.files:
        return jsonify({'error': 'No chunk provided'}), 400
    
    chunk = request.files['chunk']
    chunk_index = int(request.form.get('chunkIndex', 0))
    total_chunks = int(request.form.get('totalChunks', 1))
    upload_id = request.form.get('uploadId', session_id)
    is_last_chunk = request.form.get('isLastChunk', 'false') == 'true'
    
    # Initialize storage for this upload
    if upload_id not in _chunk_storage:
        _chunk_storage[upload_id] = {
            'chunks': {},
            'total': total_chunks,
            'session_id': session_id,
            'user_id': str(user['_id'])
        }
    
    # Store chunk data
    _chunk_storage[upload_id]['chunks'][chunk_index] = chunk.read()
    print(f"Received chunk {chunk_index + 1}/{total_chunks} for upload {upload_id}")
    
    # If this is the last chunk, combine and upload
    if is_last_chunk:
        try:
            storage = _chunk_storage[upload_id]
            
            # Combine all chunks
            combined_data = b''
            for i in range(storage['total']):
                if i in storage['chunks']:
                    combined_data += storage['chunks'][i]
            
            # Save to temp file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp:
                temp.write(combined_data)
                temp_path = temp.name
            
            # Upload to Vercel Blob or Cloudinary
            if vercel_blob_service.configured:
                result = vercel_blob_service.upload_video_multipart(
                    video_file=temp_path,
                    filename=f"session_{session_id}.webm",
                    session_id=session_id,
                    user_id=storage['user_id']
                )
                storage_type = 'vercel_blob'
            else:
                result = cloudinary_service.upload_video_chunked(
                    video_file=temp_path,
                    session_id=session_id,
                    user_id=storage['user_id']
                )
                storage_type = 'cloudinary'
            
            # Clean up
            os.unlink(temp_path)
            del _chunk_storage[upload_id]
            
            if 'error' in result:
                return jsonify({'error': result['error']}), 500
            
            # Update session with video data
            update_data = {
                'recording_url': result.get('url'),
                'recording_storage': storage_type
            }
            
            if storage_type == 'cloudinary':
                update_data['recording_public_id'] = result.get('public_id')
                update_data['recording_player_url'] = result.get('player_url')
                update_data['recording_thumbnail'] = result.get('thumbnail_url')
                update_data['recording_duration'] = result.get('duration')
                update_data['recording_format'] = result.get('format')
            else:
                # Vercel Blob specific or generic data
                update_data['recording_size'] = result.get('size')
                update_data['recording_content_type'] = result.get('contentType')
            
            db.practice_sessions.update_one(
                {'_id': ObjectId(session_id)},
                {'$set': update_data}
            )
            
            return jsonify({
                'success': True,
                'complete': True,
                'recording': {
                    'url': result.get('url'),
                    'playerUrl': result.get('player_url') if storage_type == 'cloudinary' else result.get('url'),
                    'thumbnailUrl': result.get('thumbnail_url'),
                    'duration': result.get('duration')
                }
            })
            
        except Exception as e:
            print(f"Error combining and uploading chunks: {e}")
            if upload_id in _chunk_storage:
                del _chunk_storage[upload_id]
            return jsonify({'error': str(e)}), 500
    
    return jsonify({
        'success': True,
        'chunkReceived': chunk_index,
        'complete': False
    })
