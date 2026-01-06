"""
ElevenLabs TTS Service
Text-to-speech using ElevenLabs API
"""
import requests
from config import Config
from flask import Blueprint, request, jsonify, Response

tts_bp = Blueprint('tts', __name__, url_prefix='/tts')

# ElevenLabs voice IDs
VOICE_IDS = {
    'Rachel': '21m00Tcm4TlvDq8ikWAM',
    'Drew': '29vD33N1CtxCmqQRPOHJ',
    'Clyde': '2EiwWnXFnvU5JabPnv8n',
    'Paul': '5Q0t7uMcjvnagumLfvZi',
    'Domi': 'AZnzlk1XvdvUeBnXmlld',
    'Dave': 'CYw3kZ02Hs0563khs1Fj',
    'Fin': 'D38z5RcWu1voky8WS1ja',
    'Sarah': 'EXAVITQu4vr4xnSDxMaL',
    'Antoni': 'ErXwobaYiN019PkySvjV',
    'Thomas': 'GBv7mTt0atIp3Br8iCZE',
    'Charlie': 'IKne3meq5aSn9XLyUdCD',
    'Emily': 'LcfcDJNUP1GQjkzn1xUU',
    'Elli': 'MF3mGyEYCl7XYWbV9V6O',
    'Callum': 'N2lVS1w4EtoT3dr4eOWO',
    'Patrick': 'ODq5zmih8GrVes37Dizd',
    'Harry': 'SOYHLrjzK2X1ezoPC6cr',
    'Liam': 'TX3LPaxmHKxFdv7VOQHJ',
    'Dorothy': 'ThT5KcBeYPX3keUQqHPh',
    'Josh': 'TxGEqnHWrfWFTfGW9XjX',
    'Arnold': 'VR6AewLTigWG4xSOukaG',
    'Charlotte': 'XB0fDUnXU5powFXDhCwa',
    'Matilda': 'XrExE9yKIg1WjnnlVkGX',
    'Matthew': 'Yko7PKs6WkBJ7gzEzZ6R',
    'James': 'ZQe5CZNOzWyzPSCn5a3c',
    'Joseph': 'Zlb1dXrM653N07WRdFW3',
    'Jessie': 't0jbNlBVZ17f02VDIeMI',
    'Michael': 'flq6f7yk4E4fJM5XTYuZ',
    'Ethan': 'g5CIjZEefAph4nQFvHAz',
    'Gigi': 'jBpfuIE2acCO8z3wKNLl',
    'Freya': 'jsCqWAovK2LkecY7zXl4',
    'Grace': 'oWAxZDx7w5VEj9dCyTzz',
    'Daniel': 'onwK4e9ZLuTAKqWW03F9',
    'Lily': 'pFZP5JQG7iQjIQuC4Bku',
    'Serena': 'pMsXgVXv3BLzUgSXRplE',
    'Adam': 'pNInz6obpgDQGcFmaJgB',
    'Nicole': 'piTKgcLEGmPE4e6mEKli',
    'Bill': 'pqHfZKP75CvOlQylNhV4',
    'George': 'JBFqnCBsd6RMkjVDRZzb',
    'Alice': 'Xb7hH8MSUJpSbSDYk0k2'
}


@tts_bp.route('/speak', methods=['POST'])
def text_to_speech():
    """Convert text to speech using ElevenLabs"""
    api_key = Config.ELEVENLABS_API_KEY
    
    if not api_key or api_key == 'your_elevenlabs_api_key_here':
        return jsonify({'error': 'ElevenLabs API key not configured'}), 503
    
    data = request.get_json()
    text = data.get('text', '')
    voice = data.get('voice', 'Rachel')
    
    if not text:
        return jsonify({'error': 'No text provided'}), 400
    
    voice_id = VOICE_IDS.get(voice, VOICE_IDS['Rachel'])
    
    try:
        response = requests.post(
            f'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}',
            headers={
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': api_key
            },
            json={
                'text': text,
                'model_id': 'eleven_multilingual_v2',
                'voice_settings': {
                    'stability': 0.5,
                    'similarity_boost': 0.75
                }
            }
        )
        
        if response.status_code != 200:
            return jsonify({'error': f'ElevenLabs API error: {response.status_code}'}), response.status_code
        
        return Response(
            response.content,
            mimetype='audio/mpeg',
            headers={'Content-Disposition': 'inline; filename=speech.mp3'}
        )
        
    except Exception as e:
        print(f"TTS error: {e}")
        return jsonify({'error': str(e)}), 500


@tts_bp.route('/voices', methods=['GET'])
def get_voices():
    """Get available voices"""
    return jsonify({
        'voices': [
            {'id': 'Rachel', 'name': 'Rachel (Female, Calm)'},
            {'id': 'Drew', 'name': 'Drew (Male, Professional)'},
            {'id': 'Paul', 'name': 'Paul (Male, News)'},
            {'id': 'Domi', 'name': 'Domi (Female, Strong)'},
            {'id': 'Dave', 'name': 'Dave (Male, Conversational)'},
            {'id': 'Sarah', 'name': 'Sarah (Female, Soft)'},
            {'id': 'Antoni', 'name': 'Antoni (Male, Friendly)'},
            {'id': 'Adam', 'name': 'Adam (Male, Deep)'},
            {'id': 'Charlotte', 'name': 'Charlotte (Female, British)'},
            {'id': 'Matilda', 'name': 'Matilda (Female, Warm)'}
        ]
    })
