/**
 * Hybrid Speech Analyzer - Combines backend faster-whisper and local Whisper WASM
 * Automatically switches between backend and local transcription based on connection quality
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export class HybridSpeechAnalyzer {
    constructor(options = {}) {
        this.isRunning = false;
        this.onResultCallback = null;
        this.mode = 'backend'; // 'backend' | 'local' | 'webspeech'
        this.onModeChangeCallback = null;

        // Transcription state
        this.finalTranscript = '';
        this.interimTranscript = '';
        this.wordCount = 0;
        this.fillerCount = 0;
        this.fillerWords = [];
        this.startTime = null;

        // Filler patterns to detect
        this.fillerPatterns = [
            'uh', 'um', 'ah', 'er', 'like', 'you know', 'i mean',
            'sort of', 'kind of', 'so', 'well', 'okay', 'right',
            'anyway', 'actually', 'basically', 'literally', 'honestly'
        ];

        // Audio capture state
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.stream = null;
        this.chunkInterval = null;

        // Connection quality
        this.backendLatency = null;
        this.backendAvailable = false;
        this.lastHealthCheck = 0;

        // Chunk settings (2 second chunks for good balance)
        this.chunkDurationMs = options.chunkDuration || 2000;

        // Language
        this.language = options.language || 'en-US';

        // Web Speech API fallback
        this.webSpeechRecognition = null;
    }

    async start() {
        if (this.isRunning) return true;

        try {
            // Check backend availability first
            await this.checkBackendHealth();

            // Get microphone stream
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            if (this.backendAvailable && this.backendLatency < 500) {
                // Use backend transcription
                this.mode = 'backend';
                this.startBackendTranscription();
            } else if (this.isWebSpeechSupported()) {
                // Fall back to Web Speech API
                this.mode = 'webspeech';
                this.startWebSpeechTranscription();
            } else {
                console.warn('No transcription method available');
                return false;
            }

            this.reset();
            this.startTime = Date.now();
            this.isRunning = true;

            console.log(`🎤 Hybrid STT started in ${this.mode} mode`);
            this.notifyModeChange();

            return true;
        } catch (error) {
            console.error('Failed to start hybrid speech analyzer:', error);
            return false;
        }
    }

    async checkBackendHealth() {
        try {
            const startTime = Date.now();
            const response = await fetch(`${API_URL}/stt/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(3000)
            });

            if (response.ok) {
                const data = await response.json();
                this.backendLatency = Date.now() - startTime;
                this.backendAvailable = data.status === 'ready';
                console.log(`Backend STT: ${this.backendAvailable ? 'available' : 'unavailable'}, latency: ${this.backendLatency}ms`);
            } else {
                this.backendAvailable = false;
            }
        } catch (error) {
            console.log('Backend STT not available:', error.message);
            this.backendAvailable = false;
            this.backendLatency = null;
        }
        this.lastHealthCheck = Date.now();
    }

    startBackendTranscription() {
        // Use MediaRecorder to capture chunks
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm';

        this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
        this.audioChunks = [];

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.audioChunks.push(event.data);
            }
        };

        this.mediaRecorder.onstop = async () => {
            if (this.audioChunks.length > 0 && this.isRunning) {
                await this.transcribeChunks();
            }
        };

        // Start recording and send chunks periodically
        this.mediaRecorder.start();

        this.chunkInterval = setInterval(() => {
            if (this.isRunning && this.mediaRecorder?.state === 'recording') {
                this.mediaRecorder.stop();
                this.mediaRecorder.start();
            }
        }, this.chunkDurationMs);
    }

    async transcribeChunks() {
        if (this.audioChunks.length === 0) return;

        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.audioChunks = [];

        try {
            // Convert to base64
            const base64Audio = await this.blobToBase64(audioBlob);

            const response = await fetch(`${API_URL}/stt/transcribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audio: base64Audio }),
                signal: AbortSignal.timeout(5000)
            });

            if (response.ok) {
                const result = await response.json();
                if (result.text) {
                    this.processTranscription(result.text.trim());
                }
            } else {
                // Backend failed, try fallback
                this.handleBackendFailure();
            }
        } catch (error) {
            console.error('Transcription error:', error);
            this.handleBackendFailure();
        }
    }

    handleBackendFailure() {
        if (this.mode !== 'webspeech' && this.isWebSpeechSupported()) {
            console.log('Falling back to Web Speech API');
            this.stopBackendTranscription();
            this.mode = 'webspeech';
            this.startWebSpeechTranscription();
            this.notifyModeChange();
        }
    }

    stopBackendTranscription() {
        if (this.chunkInterval) {
            clearInterval(this.chunkInterval);
            this.chunkInterval = null;
        }
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        this.mediaRecorder = null;
    }

    isWebSpeechSupported() {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }

    startWebSpeechTranscription() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        this.webSpeechRecognition = new SpeechRecognition();
        this.webSpeechRecognition.continuous = true;
        this.webSpeechRecognition.interimResults = true;
        this.webSpeechRecognition.lang = this.language;

        this.webSpeechRecognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    this.processTranscription(transcript.trim());
                } else {
                    interim += transcript;
                }
            }
            this.interimTranscript = interim;
            if (interim) this.sendUpdate(interim);
        };

        this.webSpeechRecognition.onerror = (event) => {
            if (event.error === 'no-speech' || event.error === 'aborted') {
                if (this.isRunning) {
                    setTimeout(() => {
                        if (this.isRunning && this.webSpeechRecognition) {
                            try { this.webSpeechRecognition.start(); } catch (e) { }
                        }
                    }, 100);
                }
            }
        };

        this.webSpeechRecognition.onend = () => {
            if (this.isRunning) {
                setTimeout(() => {
                    if (this.isRunning && this.webSpeechRecognition) {
                        try { this.webSpeechRecognition.start(); } catch (e) { }
                    }
                }, 100);
            }
        };

        this.webSpeechRecognition.start();
    }

    processTranscription(text) {
        if (!text) return;

        this.finalTranscript += text + ' ';

        // Count words
        const words = text.split(/\s+/).filter(w => w);
        this.wordCount += words.length;

        // Detect fillers
        this.detectFillers(text);

        // Send update
        this.sendUpdate();
    }

    detectFillers(text) {
        const lowerText = text.toLowerCase();
        this.fillerPatterns.forEach(filler => {
            const regex = new RegExp(`\\b${filler}\\b`, 'gi');
            const matches = lowerText.match(regex);
            if (matches) {
                this.fillerCount += matches.length;
                matches.forEach(() => this.fillerWords.push(filler));
            }
        });
    }

    getWPM() {
        if (!this.startTime) return 0;
        const minutes = (Date.now() - this.startTime) / 60000;
        return minutes > 0 ? Math.round(this.wordCount / minutes) : 0;
    }

    sendUpdate(interim = '') {
        if (!this.onResultCallback) return;

        this.onResultCallback({
            transcript: (this.finalTranscript + interim).slice(-200),
            fullTranscript: this.finalTranscript.trim(),
            interimTranscript: interim,
            fillerCount: this.fillerCount,
            fillerWords: this.fillerWords,
            wordCount: this.wordCount,
            wpm: this.getWPM(),
            mode: this.mode
        });
    }

    notifyModeChange() {
        if (this.onModeChangeCallback) {
            this.onModeChangeCallback(this.mode);
        }
    }

    stop() {
        this.isRunning = false;

        this.stopBackendTranscription();

        if (this.webSpeechRecognition) {
            try { this.webSpeechRecognition.stop(); } catch (e) { }
            this.webSpeechRecognition = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        console.log('🔇 Hybrid STT stopped');
    }

    onResult(callback) {
        this.onResultCallback = callback;
    }

    onModeChange(callback) {
        this.onModeChangeCallback = callback;
    }

    reset() {
        this.finalTranscript = '';
        this.interimTranscript = '';
        this.wordCount = 0;
        this.fillerCount = 0;
        this.fillerWords = [];
        this.startTime = null;
    }

    getStats() {
        return {
            transcript: this.finalTranscript,
            wordCount: this.wordCount,
            fillerCount: this.fillerCount,
            fillerWords: [...new Set(this.fillerWords)],
            wpm: this.getWPM(),
            mode: this.mode
        };
    }

    getMode() {
        return this.mode;
    }

    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    setLanguage(lang) {
        this.language = lang;
        if (this.webSpeechRecognition) {
            this.webSpeechRecognition.lang = lang;
        }
    }

    static isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }
}

export default HybridSpeechAnalyzer;
