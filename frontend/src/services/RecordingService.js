/**
 * Recording Service
 * Handles session video/audio recording using MediaRecorder API
 */

export class RecordingService {
    constructor(mediaStream) {
        this.mediaStream = mediaStream;
        this.mediaRecorder = null;
        this.recordedChunks = [];
    }

    /**
     * Start recording
     */
    start() {
        if (!this.mediaStream) {
            console.error('No media stream available');
            return;
        }

        this.recordedChunks = [];

        const options = {
            mimeType: 'video/webm;codecs=vp9,opus'
        };

        // Fallback for browsers that don't support VP9
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = 'video/webm';
        }

        try {
            this.mediaRecorder = new MediaRecorder(this.mediaStream, options);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.start(1000); // Collect data every second
            console.log('Recording started');

        } catch (error) {
            console.error('Failed to start recording:', error);
        }
    }

    /**
     * Stop recording and return the blob
     */
    async stop() {
        return new Promise((resolve) => {
            if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
                resolve(null);
                return;
            }

            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
                console.log('Recording stopped, blob size:', blob.size);
                resolve(blob);
            };

            this.mediaRecorder.stop();
        });
    }

    /**
     * Get recording state
     */
    get isRecording() {
        return this.mediaRecorder?.state === 'recording';
    }

    /**
     * Download the recording
     */
    download(blob, filename = 'practice-session.webm') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

export default RecordingService;
