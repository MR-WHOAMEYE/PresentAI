"""
Gemini AI Service
Handles AI-powered feedback generation for presentation coaching
"""
import google.generativeai as genai
from config import Config


class GeminiService:
    """Gemini API wrapper for presentation feedback"""
    
    def __init__(self):
        genai.configure(api_key=Config.GEMINI_API_KEY)
        self.model = genai.GenerativeModel('gemini-2.5-flash')
    
    def generate_realtime_feedback(self, metrics, transcript="", slide_content=""):
        """Generate real-time coaching feedback with natural language insights"""
        
        prompt = f"""You are an expert presentation coach providing conversational, natural feedback.

CURRENT METRICS:
- Eye Contact: {metrics.get('eyeContactPercent', 0)}% (means they looked at camera {metrics.get('eyeContactPercent', 0)}% and away {100 - metrics.get('eyeContactPercent', 0)}%)
- Posture Score: {metrics.get('postureScore', 'N/A')}%
- Posture Issues: {', '.join(metrics.get('postureIssues', [])) or 'None'}
- Gesture Type: {metrics.get('gestureType', 'N/A')}
- Gesture Classification: {metrics.get('gestureClassification', 'N/A')}
- Speech Rate: {metrics.get('speechRate', 'N/A')} WPM (optimal: 120-150)
- Filler Words: {', '.join(metrics.get('fillerWords', [])) or 'None'} (count: {metrics.get('fillerCount', 0)})
- Recent Speech: "{transcript[-200:] if transcript else 'No speech detected'}"

Generate feedback in JSON with NATURAL CONVERSATIONAL language. Example insights:
- "You looked at your slides 73% of the time instead of your audience"
- "Your hand gestures were mostly open and expressive - great for engagement"
- "I noticed 5 filler words (um, uh) in the last minute"
- "Your energy seems to be dropping - try varying your vocal pace"

{{
    "overallScore": <0-100>,
    "naturalInsights": [
        "<conversational observation about eye contact, e.g. 'You maintained eye contact 65% of the time'>",
        "<conversational observation about gestures>",
        "<conversational observation about speech>"
    ],
    "quickTip": "<one actionable tip phrased conversationally>",
    "positives": ["<specific strength>", "<specific strength>"],
    "improvements": ["<specific improvement>"],
    "priority": "<posture|eye_contact|gestures|speech_rate|filler_words>"
}}"""

        try:
            response = self.model.generate_content(prompt)
            response_text = response.text
            
            if '```json' in response_text:
                response_text = response_text.split('```json')[1].split('```')[0]
            elif '```' in response_text:
                response_text = response_text.split('```')[1].split('```')[0]
            
            import json
            return json.loads(response_text.strip())
        except Exception as e:
            print(f"Error generating feedback: {e}")
            eye_contact = metrics.get('eyeContactPercent', 50)
            return {
                "overallScore": 70,
                "naturalInsights": [
                    f"You maintained eye contact {eye_contact}% of the time",
                    "Your gestures are mostly neutral - try opening up more",
                ],
                "quickTip": "Try looking directly at the camera more often!",
                "positives": ["Great effort!", "Keep practicing!"],
                "improvements": ["Increase eye contact with your audience"],
                "priority": "eye_contact"
            }
    
    def generate_voice_tip(self, metrics, transcript=""):
        """Generate short, speakable tip for voice HUD (max 15 words)"""
        
        eye_contact = metrics.get('eyeContactPercent', 50)
        posture = metrics.get('postureScore', 50)
        filler_count = metrics.get('fillerCount', 0)
        wpm = metrics.get('speechRate', 120)
        
        prompt = f"""You are a friendly presentation coach giving ONE quick spoken tip.

CURRENT METRICS:
- Eye Contact: {eye_contact}%
- Posture: {posture}%
- Filler Words Used: {filler_count}
- Speech Pace: {wpm} WPM

Generate exactly ONE short, encouraging tip (max 15 words). 
Be conversational like a supportive friend.
Focus on the weakest metric.
Do NOT use markdown or special characters.

Examples:
- "Great eye contact! Try slowing down just a bit."
- "Looking good! Maybe look at the camera a bit more."
- "Nice pace! Watch those um's and uh's."

Return ONLY the tip text, nothing else."""

        try:
            response = self.model.generate_content(prompt)
            tip = response.text.strip().strip('"').strip("'")
            
            # Ensure it's not too long
            words = tip.split()
            if len(words) > 20:
                tip = ' '.join(words[:15]) + '.'
            
            return {"quickTip": tip, "success": True}
            
        except Exception as e:
            print(f"Gemini voice tip error: {e}")
            
            # Smart fallback based on weakest metric
            if eye_contact < 50:
                return {"quickTip": "Try making more eye contact with the camera.", "success": True}
            elif posture < 50:
                return {"quickTip": "Stand tall and open up your shoulders!", "success": True}
            elif filler_count > 5:
                return {"quickTip": "You're doing great! Try pausing instead of using filler words.", "success": True}
            elif wpm > 160:
                return {"quickTip": "Slow down a bit, you're speaking quite fast.", "success": True}
            else:
                return {"quickTip": "Great job! Keep up the good work.", "success": True}

    
    def generate_session_summary(self, session_metrics, transcript="", energy_timeline=None, historical_comparison=None):
        """Generate comprehensive session summary with natural language and trends"""
        
        energy_analysis = ""
        if energy_timeline and len(energy_timeline) > 1:
            first_half = energy_timeline[:len(energy_timeline)//2]
            second_half = energy_timeline[len(energy_timeline)//2:]
            first_avg = sum(e.get('postureScore', 0) for e in first_half) / len(first_half) if first_half else 0
            second_avg = sum(e.get('postureScore', 0) for e in second_half) / len(second_half) if second_half else 0
            
            if second_avg < first_avg - 10:
                energy_analysis = f"Energy dropped in the second half (from {first_avg:.0f}% to {second_avg:.0f}%)"
            elif second_avg > first_avg + 10:
                energy_analysis = f"Energy improved throughout the session (from {first_avg:.0f}% to {second_avg:.0f}%)"
            else:
                energy_analysis = "Energy levels remained consistent throughout"
        
        historical_context = ""
        if historical_comparison:
            prev_score = historical_comparison.get('previousScore', 0)
            improvement = session_metrics.get('avgPostureScore', 0) - prev_score
            if improvement > 5:
                historical_context = f"Improved {improvement:.0f}% compared to your last session!"
            elif improvement < -5:
                historical_context = f"Slightly lower than your previous session ({abs(improvement):.0f}% change)"
            else:
                historical_context = "Consistent with your recent performance"
        
        prompt = f"""You are an expert presentation coach. Generate a comprehensive, CONVERSATIONAL summary.

SESSION METRICS:
- Average Posture: {session_metrics.get('avgPostureScore', 'N/A')}%
- Average Eye Contact: {session_metrics.get('avgEyeContact', 'N/A')}%
- Average Speech Rate: {session_metrics.get('avgSpeechRate', 'N/A')} WPM
- Total Filler Words: {session_metrics.get('totalFillerWords', 0)}
- Duration: {session_metrics.get('durationMinutes', 0)} minutes
- Gesture Types Used: {session_metrics.get('gestureTypes', 'N/A')}
- Energy Analysis: {energy_analysis or 'N/A'}
- Historical Trend: {historical_context or 'First session'}
- Posture Issues: {', '.join(session_metrics.get('postureIssues', [])) or 'None'}

Generate summary in JSON with NATURAL, CONVERSATIONAL language:

{{
    "overallScore": <0-100>,
    "grade": "<A+/A/B/C/D>",
    "headline": "<one conversational sentence, e.g. 'Great progress on eye contact, but let's work on those filler words!'>",
    "naturalInsights": [
        "<e.g. 'You looked at your slides 35% of the time - try focusing on your audience more'>",
        "<e.g. 'Your energy dipped during the 3-5 minute mark - consider adding a story or pause here'>",
        "<e.g. 'I noticed you used open hand gestures 60% of the time - this helps build trust'>",
        "<e.g. 'Compared to last session, you improved your posture by 15%!'>"
    ],
    "strengths": [
        {{"area": "<area>", "detail": "<conversational praise>"}}
    ],
    "areasForImprovement": [
        {{"area": "<area>", "detail": "<conversational advice>", "exercise": "<practice suggestion>"}}
    ],
    "nextSessionGoals": ["<goal 1>", "<goal 2>", "<goal 3>"],
    "motivationalMessage": "<encouraging message>"
}}"""

        try:
            response = self.model.generate_content(prompt)
            response_text = response.text
            
            if '```json' in response_text:
                response_text = response_text.split('```json')[1].split('```')[0]
            elif '```' in response_text:
                response_text = response_text.split('```')[1].split('```')[0]
            
            import json
            return json.loads(response_text.strip())
        except Exception as e:
            print(f"Error generating summary: {e}")
            return {
                "overallScore": 75,
                "grade": "B",
                "headline": "Good practice session with room for improvement!",
                "naturalInsights": [
                    f"You maintained {session_metrics.get('avgEyeContact', 50)}% eye contact",
                    energy_analysis or "Consistent energy throughout",
                    historical_context or "Great start!"
                ],
                "strengths": [{"area": "Effort", "detail": "Great dedication to practicing!"}],
                "areasForImprovement": [
                    {"area": "Eye Contact", "detail": "Try looking at the camera more", "exercise": "Practice with a small sticky note near camera"}
                ],
                "nextSessionGoals": ["Maintain better eye contact", "Reduce filler words"],
                "motivationalMessage": "Keep practicing! Every session makes you better."
            }
    
    def generate_feedback_for_slides(self, session_summary, presentation_title):
        """Generate formatted feedback to add to speaker notes"""
        
        prompt = f"""Based on this practice session summary for "{presentation_title}", generate speaker notes feedback that can be added to the presentation.

SESSION SUMMARY:
{session_summary}

Generate feedback in this format (plain text, suitable for speaker notes):

---
🎤 PRACTICE SESSION FEEDBACK
Date: [Current Date]
Overall Score: [Score]/100

✅ STRENGTHS:
• [Strength 1]
• [Strength 2]

📈 AREAS TO IMPROVE:
• [Area 1]: [Specific tip]
• [Area 2]: [Specific tip]

🎯 NEXT STEPS:
• [Goal 1]
• [Goal 2]
---

Keep it concise and actionable. Use emojis sparingly for visual appeal."""

        try:
            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            print(f"Error generating slides feedback: {e}")
            return f"Practice session completed. Score: {session_summary.get('overallScore', 'N/A')}/100"
    
    def transcribe_audio(self, audio_data, mime_type="audio/webm"):
        """Transcribe audio using Gemini and analyze for filler words"""
        
        prompt = """You are a speech transcription and analysis expert. 
Transcribe the following audio and identify any filler words or hesitations.

FILLER WORDS TO DETECT:
- "um", "uh", "uhh", "umm", "hmm"
- "like" (when used as filler, not comparison)
- "you know", "I mean", "sort of", "kind of"
- "actually", "basically", "literally" (when overused)
- "so" (when starting sentences unnecessarily)
- "right", "okay" (as verbal tics)

Return in this exact JSON format:
{
    "transcript": "<exact transcription of speech>",
    "fillerWords": [{"word": "<filler>", "count": <number>}],
    "totalFillerCount": <number>,
    "wordCount": <number>,
    "speechClarity": "<clear|moderate|needs_improvement>",
    "hesitationPatterns": "<description of any hesitation patterns noticed>"
}

If no speech is detected, return:
{
    "transcript": "",
    "fillerWords": [],
    "totalFillerCount": 0,
    "wordCount": 0,
    "speechClarity": "no_speech",
    "hesitationPatterns": "No speech detected"
}"""

        try:
            import base64
            
            # Create audio content for Gemini
            audio_part = {
                "inline_data": {
                    "mime_type": mime_type,
                    "data": base64.b64encode(audio_data).decode('utf-8')
                }
            }
            
            response = self.model.generate_content([prompt, audio_part])
            response_text = response.text
            
            # Extract JSON from response
            if '```json' in response_text:
                response_text = response_text.split('```json')[1].split('```')[0]
            elif '```' in response_text:
                response_text = response_text.split('```')[1].split('```')[0]
            
            import json
            return json.loads(response_text.strip())
            
        except Exception as e:
            print(f"Error transcribing audio: {e}")
            return {
                "transcript": "",
                "fillerWords": [],
                "totalFillerCount": 0,
                "wordCount": 0,
                "speechClarity": "error",
                "hesitationPatterns": str(e)
            }
    
    def analyze_text_for_fillers(self, text):
        """Analyze text for filler words without audio"""
        
        prompt = f"""Analyze this speech transcript for filler words and speaking patterns:

TRANSCRIPT: "{text}"

FILLER WORDS TO DETECT (case-insensitive):
- Verbal fillers: um, uh, uhh, umm, hmm, er, ah
- Discourse markers as fillers: like, you know, I mean, sort of, kind of
- Overused words: actually, basically, literally, seriously
- Sentence starters: so, well, okay, right

Return in this exact JSON format:
{{
    "fillerWords": [{{"word": "<filler>", "count": <number>}}],
    "totalFillerCount": <number>,
    "wordCount": <number>,
    "wordsPerMinute": null,
    "fillerRate": <percentage as decimal, e.g. 0.05 for 5%>,
    "suggestions": ["<improvement suggestion 1>", "<improvement suggestion 2>"]
}}"""

        try:
            response = self.model.generate_content(prompt)
            response_text = response.text
            
            # Extract JSON
            if '```json' in response_text:
                response_text = response_text.split('```json')[1].split('```')[0]
            elif '```' in response_text:
                response_text = response_text.split('```')[1].split('```')[0]
            
            import json
            return json.loads(response_text.strip())
            
        except Exception as e:
            print(f"Error analyzing text: {e}")
            # Fallback to simple regex-based detection
            import re
            filler_patterns = ['um', 'uh', 'uhh', 'umm', 'like', 'you know', 'i mean', 'basically', 'actually']
            filler_counts = {}
            lower_text = text.lower()
            
            for filler in filler_patterns:
                count = len(re.findall(r'\b' + filler + r'\b', lower_text))
                if count > 0:
                    filler_counts[filler] = count
            
            total = sum(filler_counts.values())
            words = len(text.split())
            
            return {
                "fillerWords": [{"word": k, "count": v} for k, v in filler_counts.items()],
                "totalFillerCount": total,
                "wordCount": words,
                "wordsPerMinute": None,
                "fillerRate": total / words if words > 0 else 0,
                "suggestions": []
            }


gemini_service = GeminiService()
