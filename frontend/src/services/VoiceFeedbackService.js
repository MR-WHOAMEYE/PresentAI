/**
 * Voice Feedback Service
 * Handles real-time voice feedback using Gemini + ElevenLabs
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

class VoiceFeedbackService {
    constructor() {
        this.isEnabled = false
        this.isSpeaking = false
        this.speechQueue = []
        this.currentAudio = null
        this.voiceId = 'Rachel'
        this.speed = 1.0
        this.lastFeedbackTime = 0
        this.feedbackInterval = 20000 // 20 seconds between feedback

        this.loadSettings()
    }

    loadSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('tts_settings') || '{}')
            this.isEnabled = settings.isEnabled ?? false
            this.voiceId = settings.voiceId || 'Rachel'
            this.speed = settings.speed || 1.0
        } catch (e) {
            console.error('Failed to load TTS settings:', e)
        }
    }

    /**
     * Get real-time feedback from Gemini and speak it
     */
    async getFeedbackAndSpeak(metrics, transcript = '') {
        if (!this.isEnabled || this.isSpeaking) return null

        // Rate limit - only get feedback every 20 seconds
        const now = Date.now()
        if (now - this.lastFeedbackTime < this.feedbackInterval) return null
        this.lastFeedbackTime = now

        try {
            // Get quick feedback from Gemini
            const response = await fetch(`${API_URL}/analyze/realtime-voice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ metrics, transcript })
            })

            if (!response.ok) return null

            const data = await response.json()
            const feedback = data.feedback?.quickTip || data.feedback?.tip

            if (feedback) {
                await this.speak(feedback)
                return feedback
            }

            return null
        } catch (error) {
            console.error('Voice feedback error:', error)
            return null
        }
    }

    /**
     * Speak text using ElevenLabs via backend
     */
    async speak(text) {
        if (!text || this.isSpeaking) return

        // Clean text for speech
        const cleanText = text
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/[#_`]/g, '')
            .trim()

        if (!cleanText) return

        this.isSpeaking = true

        try {
            const response = await fetch(`${API_URL}/tts/speak`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    text: cleanText,
                    voice: this.voiceId
                })
            })

            if (response.ok && response.headers.get('content-type')?.includes('audio')) {
                const blob = await response.blob()
                const url = URL.createObjectURL(blob)

                this.currentAudio = new Audio(url)
                this.currentAudio.playbackRate = this.speed

                this.currentAudio.onended = () => {
                    URL.revokeObjectURL(url)
                    this.isSpeaking = false
                    this.currentAudio = null
                }

                this.currentAudio.onerror = () => {
                    this.isSpeaking = false
                    this.currentAudio = null
                }

                await this.currentAudio.play()
            } else {
                // Fallback to browser TTS
                this.speakBrowser(cleanText)
            }
        } catch (error) {
            console.error('TTS error:', error)
            this.speakBrowser(cleanText)
        }
    }

    /**
     * Browser TTS fallback
     */
    speakBrowser(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text)
            utterance.rate = this.speed
            utterance.onend = () => { this.isSpeaking = false }
            utterance.onerror = () => { this.isSpeaking = false }
            window.speechSynthesis.speak(utterance)
        } else {
            this.isSpeaking = false
        }
    }

    /**
     * Stop current speech
     */
    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause()
            this.currentAudio = null
        }
        window.speechSynthesis?.cancel()
        this.isSpeaking = false
    }

    /**
     * Enable/disable voice feedback
     */
    setEnabled(enabled) {
        this.isEnabled = enabled
        if (!enabled) this.stop()
    }

    /**
     * Update settings
     */
    updateSettings(settings) {
        if (settings.voiceId) this.voiceId = settings.voiceId
        if (settings.speed) this.speed = settings.speed
        if (settings.isEnabled !== undefined) this.isEnabled = settings.isEnabled
    }
}

// Singleton
const voiceFeedbackService = new VoiceFeedbackService()
export default voiceFeedbackService
