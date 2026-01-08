/**
 * Hybrid Speech Analyzer - Multi-platform speech to text
 * Supports: Capacitor Native (mobile), Backend faster-whisper, Web Speech API
 * Automatically selects best available method based on platform and connection
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Check if running in Capacitor
const isCapacitor = () => {
    return window.Capacitor !== undefined;
};

// Check if running on mobile
const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (window.Capacitor?.isNativePlatform?.() === true);
};

export class HybridSpeechAnalyzer {
    constructor(options = {}) {
        this.isRunning = false;
        this.onResultCallback = null;
        this.mode = 'detecting'; // 'capacitor' | 'backend' | 'webspeech' | 'detecting'
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

        // Capacitor Speech Recognition
        this.capacitorSpeechRecognition = null;
        this.capacitorAvailable = false;

        // Platform info
        this.isMobileDevice = isMobile();
        this.isCapacitorApp = isCapacitor();
    }

    async start() {
        if (this.isRunning) return true;

        try {
            // Try methods in order of preference based on platform
            if (this.isCapacitorApp) {
                // Mobile app: Try Capacitor native first
                const capacitorStarted = await this.tryCapacitorSpeech();
                if (capacitorStarted) {
                    this.mode = 'capacitor';
                    this.reset();
                    this.startTime = Date.now();
                    this.isRunning = true;
                    console.log('🎤 Started with Capacitor native speech recognition');
                    this.notifyModeChange();
                    return true;
                }
            }

            // Check backend availability
            await this.checkBackendHealth();

            if (this.backendAvailable && this.backendLatency < 500) {
                // Get microphone stream for backend mode
                this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.mode = 'backend';
                this.startBackendTranscription();
            } else if (this.isWebSpeechSupported()) {
                // Fall back to Web Speech API
                this.mode = 'webspeech';
                // Web Speech doesn't need getUserMedia on most browsers
                this.startWebSpeechTranscription();
            } else {
                console.warn('No transcription method available');
                return false;
            }

            this.reset();
            this.startTime = Date.now();
            this.isRunning = true;

            console.log(`🎤 Hybrid STT started in ${this.mode} mode (mobile: ${this.isMobileDevice})`);
            this.notifyModeChange();

            return true;
        } catch (error) {
            console.error('Failed to start hybrid speech analyzer:', error);
            // Try Web Speech as last resort
            if (this.isWebSpeechSupported()) {
                try {
                    this.mode = 'webspeech';
                    this.startWebSpeechTranscription();
                    this.reset();
                    this.startTime = Date.now();
                    this.isRunning = true;
                    console.log('🎤 Fallback to Web Speech API');
                    this.notifyModeChange();
                    return true;
                } catch (e) {
                    console.error('Web Speech fallback failed:', e);
                }
            }
            return false;
        }
    }

    /**
     * Try to start Capacitor native speech recognition
     */
    async tryCapacitorSpeech() {
        // Only attempt if we're in a Capacitor environment
        if (!window.Capacitor?.isNativePlatform?.()) {
            console.log('Not in Capacitor native environment, skipping native speech');
            return false;
        }

        try {
            // Check if the plugin is registered in Capacitor
            const plugins = window.Capacitor?.Plugins;
            if (!plugins?.SpeechRecognition) {
                console.log('Capacitor SpeechRecognition plugin not installed');
                return false;
            }

            const SpeechRecognition = plugins.SpeechRecognition;

            // Check if available
            const available = await SpeechRecognition.available();
            if (!available.available) {
                console.log('Capacitor Speech Recognition not available on this device');
                return false;
            }

            // Request permission
            const permission = await SpeechRecognition.requestPermissions();
            if (permission.speechRecognition !== 'granted') {
                console.log('Speech recognition permission denied');
                return false;
            }

            this.capacitorSpeechRecognition = SpeechRecognition;
            this.capacitorAvailable = true;

            // Start listening
            await SpeechRecognition.start({
                language: this.language,
                maxResults: 5,
                prompt: 'Speak now...',
                partialResults: true,
                popup: false
            });

            // Add listener for results
            SpeechRecognition.addListener('partialResults', (data) => {
                if (data.matches && data.matches.length > 0) {
                    this.interimTranscript = data.matches[0];
                    this.sendUpdate(this.interimTranscript);
                }
            });

            SpeechRecognition.addListener('listeningState', (state) => {
                if (state.status === 'stopped' && this.isRunning) {
                    // Process final result and restart
                    if (this.interimTranscript) {
                        this.processTranscription(this.interimTranscript);
                        this.interimTranscript = '';
                    }
                    // Restart listening
                    setTimeout(() => {
                        if (this.isRunning && this.capacitorSpeechRecognition) {
                            this.capacitorSpeechRecognition.start({
                                language: this.language,
                                maxResults: 5,
                                partialResults: true,
                                popup: false
                            }).catch(e => console.log('Restart failed:', e));
                        }
                    }, 100);
                }
            });

            return true;
        } catch (error) {
            console.log('Capacitor Speech Recognition not available:', error.message);
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

        // Stop Capacitor speech recognition
        if (this.capacitorSpeechRecognition) {
            try {
                this.capacitorSpeechRecognition.stop();
                this.capacitorSpeechRecognition.removeAllListeners();
            } catch (e) { }
            this.capacitorSpeechRecognition = null;
        }

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
        // Check for any supported method
        const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
        const hasWebSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
        const hasCapacitor = isCapacitor();

        return hasGetUserMedia || hasWebSpeech || hasCapacitor;
    }

    /**
     * Get platform info for UI display
     */
    static getPlatformInfo() {
        return {
            isMobile: isMobile(),
            isCapacitor: isCapacitor(),
            hasWebSpeech: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
            hasMicrophone: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
        };
    }
}

export default HybridSpeechAnalyzer;
