/**
 * Voice Feedback Service
 * Real-time voice feedback using Gemini for AI tips + ElevenLabs for TTS
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
        this.volume = 1.0
        this.lastFeedbackTime = 0
        this.feedbackInterval = 20000 // 20 seconds between feedback
        this.minFeedbackInterval = 10000 // Minimum 10 seconds
        this.maxFeedbackInterval = 60000 // Maximum 60 seconds

        // Callbacks
        this.onTipCallback = null
        this.onSpeakingChangeCallback = null
        this.onErrorCallback = null

        // Available voices
        this.availableVoices = [
            { id: 'Rachel', name: 'Rachel', description: 'Female, Calm' },
            { id: 'Drew', name: 'Drew', description: 'Male, Professional' },
            { id: 'Sarah', name: 'Sarah', description: 'Female, Soft' },
            { id: 'Adam', name: 'Adam', description: 'Male, Deep' },
            { id: 'Charlotte', name: 'Charlotte', description: 'Female, British' },
            { id: 'Dave', name: 'Dave', description: 'Male, Conversational' },
        ]

        this.loadSettings()
    }

    loadSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('voice_feedback_settings') || '{}')
            this.isEnabled = settings.isEnabled ?? false
            this.voiceId = settings.voiceId || 'Rachel'
            this.speed = settings.speed || 1.0
            this.volume = settings.volume ?? 1.0
            this.feedbackInterval = settings.feedbackInterval || 20000
        } catch (e) {
            console.error('Failed to load voice feedback settings:', e)
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('voice_feedback_settings', JSON.stringify({
                isEnabled: this.isEnabled,
                voiceId: this.voiceId,
                speed: this.speed,
                volume: this.volume,
                feedbackInterval: this.feedbackInterval
            }))
        } catch (e) {
            console.error('Failed to save voice feedback settings:', e)
        }
    }

    /**
     * Get real-time feedback from Gemini and speak it via ElevenLabs
     */
    async getFeedbackAndSpeak(metrics, transcript = '') {
        if (!this.isEnabled || this.isSpeaking) return null

        // Rate limit
        const now = Date.now()
        if (now - this.lastFeedbackTime < this.feedbackInterval) return null
        this.lastFeedbackTime = now

        try {
            // Get quick tip from Gemini via backend
            const response = await fetch(`${API_URL}/analyze/realtime-voice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ metrics, transcript })
            })

            if (!response.ok) {
                console.warn('Voice feedback API returned:', response.status)
                return null
            }

            const data = await response.json()
            const feedback = data.feedback?.quickTip || data.feedback?.tip

            if (feedback) {
                // Notify listeners about the tip
                this.onTipCallback?.(feedback)

                // Speak the tip
                await this.speak(feedback)
                return feedback
            }

            return null
        } catch (error) {
            console.error('Voice feedback error:', error)
            this.onErrorCallback?.(error)
            return null
        }
    }

    /**
     * Speak text using ElevenLabs TTS via backend
     */
    async speak(text) {
        if (!text || this.isSpeaking) return false

        // Clean text for speech (remove markdown, etc.)
        const cleanText = text
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/[#_`]/g, '')
            .replace(/\s+/g, ' ')
            .trim()

        if (!cleanText || cleanText.length < 5) return false

        this.isSpeaking = true
        this.onSpeakingChangeCallback?.(true)

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
                this.currentAudio.volume = this.volume

                // Handle audio end
                this.currentAudio.onended = () => {
                    URL.revokeObjectURL(url)
                    this.isSpeaking = false
                    this.currentAudio = null
                    this.onSpeakingChangeCallback?.(false)
                }

                // Handle audio error
                this.currentAudio.onerror = (e) => {
                    console.error('Audio playback error:', e)
                    URL.revokeObjectURL(url)
                    this.isSpeaking = false
                    this.currentAudio = null
                    this.onSpeakingChangeCallback?.(false)
                    // Try browser fallback
                    this.speakBrowser(cleanText)
                }

                await this.currentAudio.play()
                return true
            } else {
                // ElevenLabs not available - fallback to browser TTS
                console.log('ElevenLabs unavailable, using browser TTS')
                this.speakBrowser(cleanText)
                return true
            }
        } catch (error) {
            console.error('TTS error:', error)
            this.speakBrowser(cleanText)
            return false
        }
    }

    /**
     * Browser TTS fallback (Web Speech API)
     */
    speakBrowser(text) {
        if ('speechSynthesis' in window) {
            // Cancel any ongoing speech
            window.speechSynthesis.cancel()

            const utterance = new SpeechSynthesisUtterance(text)
            utterance.rate = this.speed
            utterance.volume = this.volume

            utterance.onend = () => {
                this.isSpeaking = false
                this.onSpeakingChangeCallback?.(false)
            }

            utterance.onerror = () => {
                this.isSpeaking = false
                this.onSpeakingChangeCallback?.(false)
            }

            window.speechSynthesis.speak(utterance)
        } else {
            this.isSpeaking = false
            this.onSpeakingChangeCallback?.(false)
        }
    }

    /**
     * Stop current speech
     */
    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause()
            this.currentAudio.currentTime = 0
            this.currentAudio = null
        }
        window.speechSynthesis?.cancel()
        this.isSpeaking = false
        this.onSpeakingChangeCallback?.(false)
    }

    /**
     * Skip current tip and allow next one immediately
     */
    skip() {
        this.stop()
        this.lastFeedbackTime = 0 // Allow immediate next feedback
    }

    // --- Settings ---

    setEnabled(enabled) {
        this.isEnabled = enabled
        if (!enabled) this.stop()
        this.saveSettings()
    }

    setVoice(voiceId) {
        this.voiceId = voiceId
        this.saveSettings()
    }

    setSpeed(speed) {
        this.speed = Math.max(0.5, Math.min(2.0, speed))
        if (this.currentAudio) {
            this.currentAudio.playbackRate = this.speed
        }
        this.saveSettings()
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume))
        if (this.currentAudio) {
            this.currentAudio.volume = this.volume
        }
        this.saveSettings()
    }

    setFeedbackInterval(intervalMs) {
        this.feedbackInterval = Math.max(this.minFeedbackInterval, Math.min(this.maxFeedbackInterval, intervalMs))
        this.saveSettings()
    }

    // --- Callbacks ---

    onTip(callback) {
        this.onTipCallback = callback
    }

    onSpeakingChange(callback) {
        this.onSpeakingChangeCallback = callback
    }

    onError(callback) {
        this.onErrorCallback = callback
    }

    // --- Getters ---

    getSettings() {
        return {
            isEnabled: this.isEnabled,
            voiceId: this.voiceId,
            speed: this.speed,
            volume: this.volume,
            feedbackInterval: this.feedbackInterval
        }
    }

    getAvailableVoices() {
        return this.availableVoices
    }

    getIsSpeaking() {
        return this.isSpeaking
    }
}

// Singleton instance
const voiceFeedbackService = new VoiceFeedbackService()
export default voiceFeedbackService
