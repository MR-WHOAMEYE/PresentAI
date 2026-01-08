"""
Analysis Routes
Handles AI-powered feedback generation with MongoDB
"""
from flask import Blueprint, request, session, jsonify, current_app
from bson import ObjectId
from services.gemini_service import gemini_service
from services.google_auth import google_auth_service
from services.slides_service import get_slides_service
from functools import wraps

analyze_bp = Blueprint('analyze', __name__, url_prefix='/analyze')


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


@analyze_bp.route('/realtime', methods=['POST'])
@require_auth
def analyze_realtime(user):
    """Generate real-time feedback based on current metrics"""
    data = request.get_json() or {}
    
    metrics = data.get('metrics', {})
    transcript = data.get('transcript', '')
    slide_content = data.get('slideContent', '')
    
    try:
        feedback = gemini_service.generate_realtime_feedback(
            metrics=metrics,
            transcript=transcript,
            slide_content=slide_content
        )
        
        return jsonify({
            'feedback': feedback
        })
    except Exception as e:
        print(f"Error generating feedback: {e}")
        return jsonify({'error': 'Failed to generate feedback'}), 500


@analyze_bp.route('/session-summary', methods=['POST'])
@require_auth
def analyze_session_summary(user):
    """Generate comprehensive AI session summary for FeedbackPage"""
    data = request.get_json() or {}
    
    transcript = data.get('transcript', '')
    metrics = data.get('metrics', {})
    duration_seconds = data.get('durationSeconds', 0)
    
    # Transform metrics to the format expected by gemini_service
    session_metrics = {
        'avgPostureScore': metrics.get('postureScore', 0),
        'avgEyeContact': metrics.get('eyeContactPercent', 0),
        'avgSpeechRate': metrics.get('speechRate', 0),
        'totalFillerWords': metrics.get('fillerCount', 0),
        'durationMinutes': round(duration_seconds / 60, 1),
        'gestureTypes': metrics.get('gestureType', 'N/A'),
        'postureIssues': metrics.get('postureIssues', [])
    }
    
    try:
        # Generate AI summary
        summary_data = gemini_service.generate_session_summary(
            session_metrics=session_metrics,
            transcript=transcript
        )
        
        # Transform response to match FeedbackPage expected format
        result = {
            'overallScore': summary_data.get('overallScore', 0),
            'grade': summary_data.get('grade', 'B'),
            'summary': summary_data.get('headline', 'Good practice session!'),
            'naturalInsights': summary_data.get('naturalInsights', []),
            
            # Map strengths to positives array for FeedbackPage
            'positives': [
                s.get('detail', s.get('area', 'Great effort!')) 
                for s in summary_data.get('strengths', [])
            ],
            
            # Map areasForImprovement to improvements array for FeedbackPage
            'improvements': [
                f"{area.get('area', '')}: {area.get('detail', '')}" 
                for area in summary_data.get('areasForImprovement', [])
            ],
            
            'nextSessionGoals': summary_data.get('nextSessionGoals', []),
            'motivationalMessage': summary_data.get('motivationalMessage', 'Keep practicing!')
        }
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error generating session summary: {e}")
        
        # Compute fallback score
        posture = metrics.get('postureScore', 0)
        eye = metrics.get('eyeContactPercent', 0)
        fallback_score = round((posture * 0.3 + eye * 0.4 + 50 * 0.3))
        
        return jsonify({
            'overallScore': fallback_score,
            'grade': 'B' if fallback_score >= 70 else 'C',
            'summary': 'Good practice session with room for improvement.',
            'naturalInsights': [
                f"You maintained {eye}% eye contact with the camera.",
                f"Your posture score was {posture}%."
            ],
            'positives': ['Great effort in practicing!', 'Keep up the momentum!'],
            'improvements': ['Focus on maintaining eye contact with your audience.'],
            'nextSessionGoals': ['Improve eye contact', 'Practice more regularly'],
            'motivationalMessage': 'Every practice session makes you better!'
        })



@analyze_bp.route('/realtime-voice', methods=['POST'])
@require_auth
def analyze_realtime_voice(user):
    """Generate short, speakable feedback for voice HUD"""
    data = request.get_json() or {}
    
    metrics = data.get('metrics', {})
    transcript = data.get('transcript', '')
    
    try:
        feedback = gemini_service.generate_voice_tip(
            metrics=metrics,
            transcript=transcript
        )
        
        return jsonify({
            'feedback': feedback
        })
    except Exception as e:
        print(f"Error generating voice feedback: {e}")
        return jsonify({'error': 'Failed to generate feedback'}), 500


@analyze_bp.route('/summary', methods=['POST'])
@require_auth
def generate_summary(user):
    """Generate session summary"""
    data = request.get_json() or {}
    
    session_metrics = data.get('sessionMetrics', {})
    transcript = data.get('transcript', '')
    
    try:
        summary = gemini_service.generate_session_summary(
            session_metrics=session_metrics,
            transcript=transcript
        )
        
        return jsonify({
            'summary': summary
        })
    except Exception as e:
        print(f"Error generating summary: {e}")
        return jsonify({'error': 'Failed to generate summary'}), 500


@analyze_bp.route('/slides-feedback', methods=['POST'])
@require_auth
def generate_slides_feedback(user):
    """Generate feedback formatted for speaker notes"""
    data = request.get_json() or {}
    
    session_summary = data.get('sessionSummary', {})
    presentation_title = data.get('presentationTitle', 'Presentation')
    
    try:
        feedback_text = gemini_service.generate_feedback_for_slides(
            session_summary=session_summary,
            presentation_title=presentation_title
        )
        
        return jsonify({
            'feedbackText': feedback_text
        })
    except Exception as e:
        print(f"Error generating slides feedback: {e}")
        return jsonify({'error': 'Failed to generate slides feedback'}), 500


@analyze_bp.route('/write-to-slides', methods=['POST'])
@require_auth
def write_feedback_to_slides(user):
    """Generate and write feedback to slide speaker notes"""
    data = request.get_json() or {}
    
    presentation_id = data.get('presentationId')
    slide_id = data.get('slideId')
    session_summary = data.get('sessionSummary', {})
    presentation_title = data.get('presentationTitle', 'Presentation')
    
    if not presentation_id or not slide_id:
        return jsonify({'error': 'presentationId and slideId are required'}), 400
    
    try:
        db = get_db()
        
        # Get credentials
        credentials = google_auth_service.get_valid_credentials_from_doc(user, db)
        if not credentials:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Generate feedback
        feedback_text = gemini_service.generate_feedback_for_slides(
            session_summary=session_summary,
            presentation_title=presentation_title
        )
        
        # Write to slides
        slides_service = get_slides_service(credentials)
        success = slides_service.update_speaker_notes(
            presentation_id=presentation_id,
            slide_object_id=slide_id,
            notes_text=feedback_text
        )
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Feedback written to speaker notes',
                'feedbackText': feedback_text
            })
        else:
            return jsonify({'error': 'Failed to write to slides'}), 500
            
    except Exception as e:
        print(f"Error writing to slides: {e}")
        return jsonify({'error': 'Failed to write feedback to slides'}), 500


@analyze_bp.route('/analyze-text', methods=['POST'])
@require_auth
def analyze_text(user):
    """Analyze text transcript for filler words using Gemini"""
    data = request.get_json() or {}
    
    text = data.get('text', '')
    
    if not text:
        return jsonify({'error': 'No text provided'}), 400
    
    try:
        result = gemini_service.analyze_text_for_fillers(text)
        return jsonify(result)
        
    except Exception as e:
        print(f"Error analyzing text: {e}")
        return jsonify({'error': 'Failed to analyze text'}), 500

