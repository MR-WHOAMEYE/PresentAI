/**
 * Speech Analyzer - Uses Web Speech API for real-time transcription
 * Detects filler words and calculates speech metrics
 */

export class SpeechAnalyzer {
    constructor(options = {}) {
        this.isRunning = false;
        this.onResultCallback = null;
        this.recognition = null;

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
            'anyway', 'actually', 'basically', 'literally', 'honestly',
            'mhmm', 'hmm'
        ];

        // Language setting
        this.language = options.language || 'en-US';
    }

    async start() {
        if (this.isRunning) return true;

        // Check browser support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.error('Web Speech API not supported');
            if (this.onResultCallback) {
                this.onResultCallback({
                    fullTranscript: 'Speech recognition not supported in this browser.',
                    fillerCount: 0, fillerWords: [], wordCount: 0, wpm: 0
                });
            }
            return false;
        }

        try {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = this.language;
            this.recognition.maxAlternatives = 1;

            // Handle results
            this.recognition.onresult = (event) => {
                let interim = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;

                    if (event.results[i].isFinal) {
                        // Final result - add to transcript
                        this.finalTranscript += transcript + ' ';

                        // Count words
                        const words = transcript.trim().split(/\s+/).filter(w => w);
                        this.wordCount += words.length;

                        // Detect filler words
                        this.detectFillers(transcript);

                        // Send update
                        this.sendUpdate();
                    } else {
                        // Interim result
                        interim += transcript;
                    }
                }

                this.interimTranscript = interim;

                // Also send updates for interim results (for live display)
                if (interim) {
                    this.sendUpdate(interim);
                }
            };

            // Handle errors
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);

                // Auto-restart on certain errors
                if (event.error === 'no-speech' || event.error === 'aborted') {
                    if (this.isRunning) {
                        setTimeout(() => {
                            if (this.isRunning) {
                                this.recognition.start();
                            }
                        }, 100);
                    }
                }
            };

            // Handle end - auto-restart if still running
            this.recognition.onend = () => {
                if (this.isRunning) {
                    setTimeout(() => {
                        if (this.isRunning) {
                            try {
                                this.recognition.start();
                            } catch (e) {
                                console.log('Recognition restart skipped');
                            }
                        }
                    }, 100);
                }
            };

            // Start recognition
            this.reset();
            this.startTime = Date.now();
            this.isRunning = true;
            this.recognition.start();

            console.log('🎤 Web Speech API recognition started');
            return true;

        } catch (error) {
            console.error('Failed to start speech recognition:', error);
            if (this.onResultCallback) {
                this.onResultCallback({
                    fullTranscript: 'Failed to start speech recognition.',
                    fillerCount: 0, fillerWords: [], wordCount: 0, wpm: 0
                });
            }
            return false;
        }
    }

    stop() {
        this.isRunning = false;

        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (e) {
                // Ignore stop errors
            }
            this.recognition = null;
        }

        console.log('🔇 Web Speech API recognition stopped');
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
            wpm: this.getWPM()
        });
    }

    onResult(callback) {
        this.onResultCallback = callback;
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
            wpm: this.getWPM()
        };
    }

    /**
     * Set recognition language
     */
    setLanguage(lang) {
        this.language = lang;
        if (this.recognition) {
            this.recognition.lang = lang;
        }
    }

    /**
     * Check if Web Speech API is supported
     */
    static isSupported() {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }
}

export default SpeechAnalyzer;
