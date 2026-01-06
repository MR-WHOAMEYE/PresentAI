/**
 * Face Analyzer
 * Uses MediaPipe Face Landmarker for eye contact tracking
 */

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export class FaceAnalyzer {
    constructor(videoElement) {
        this.video = videoElement;
        this.faceLandmarker = null;
        this.lastResults = null;
        this.eyeContactHistory = [];
        this.historyLength = 30; // Track last 30 frames
    }

    /**
     * Initialize the face landmarker
     */
    async initialize() {
        try {
            const vision = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
            );

            this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                    delegate: 'GPU'
                },
                runningMode: 'VIDEO',
                numFaces: 1,
                outputFaceBlendshapes: true
            });

            console.log('Face analyzer initialized');

        } catch (error) {
            console.error('Failed to initialize face analyzer:', error);
            // Try CPU fallback
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
                );

                this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                        delegate: 'CPU'
                    },
                    runningMode: 'VIDEO',
                    numFaces: 1,
                    outputFaceBlendshapes: true
                });

                console.log('Face analyzer initialized with CPU fallback');
            } catch (fallbackError) {
                console.error('Failed to initialize face analyzer with CPU fallback:', fallbackError);
            }
        }
    }

    /**
     * Analyze current video frame
     */
    async analyze() {
        if (!this.faceLandmarker || this.video.readyState < 2) {
            return {
                eyeContactPercent: 0,
                isLookingAtCamera: false
            };
        }

        const startTime = performance.now();
        const results = this.faceLandmarker.detectForVideo(this.video, startTime);
        this.lastResults = results;

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            const landmarks = results.faceLandmarks[0];
            const isLooking = this.checkEyeContact(landmarks, results.faceBlendshapes);

            // Update history
            this.eyeContactHistory.push(isLooking ? 1 : 0);
            if (this.eyeContactHistory.length > this.historyLength) {
                this.eyeContactHistory.shift();
            }

            // Calculate percentage
            const eyeContactPercent = Math.round(
                (this.eyeContactHistory.reduce((a, b) => a + b, 0) / this.eyeContactHistory.length) * 100
            );

            return {
                eyeContactPercent,
                isLookingAtCamera: isLooking
            };
        }

        return {
            eyeContactPercent: Math.round(
                (this.eyeContactHistory.reduce((a, b) => a + b, 0) / Math.max(1, this.eyeContactHistory.length)) * 100
            ),
            isLookingAtCamera: false
        };
    }

    /**
     * Check if user is making eye contact with camera
     */
    checkEyeContact(landmarks, blendshapes) {
        // Use iris landmarks to determine gaze direction
        // Iris landmarks: 468-477 (right iris), 473-477 (left iris)
        // Or use face blendshapes if available

        if (blendshapes && blendshapes.length > 0) {
            const shapes = blendshapes[0].categories;

            // Find eye-related blendshapes
            const eyeLookDown = shapes.find(s => s.categoryName === 'eyeLookDownLeft' || s.categoryName === 'eyeLookDownRight');
            const eyeLookUp = shapes.find(s => s.categoryName === 'eyeLookUpLeft' || s.categoryName === 'eyeLookUpRight');
            const eyeLookIn = shapes.find(s => s.categoryName === 'eyeLookInLeft' || s.categoryName === 'eyeLookInRight');
            const eyeLookOut = shapes.find(s => s.categoryName === 'eyeLookOutLeft' || s.categoryName === 'eyeLookOutRight');

            // If looking significantly in any direction, not making eye contact
            const downScore = eyeLookDown?.score || 0;
            const upScore = eyeLookUp?.score || 0;
            const inScore = eyeLookIn?.score || 0;
            const outScore = eyeLookOut?.score || 0;

            const maxDeviation = Math.max(downScore, upScore, inScore, outScore);

            // If eye deviation is low, they're looking at camera
            return maxDeviation < 0.3;
        }

        // Fallback: use face orientation
        // Check nose position relative to face center
        const noseTop = landmarks[4];      // Nose tip
        const leftEye = landmarks[33];     // Left eye outer corner
        const rightEye = landmarks[263];   // Right eye outer corner

        // Face center approximation
        const faceCenter = {
            x: (leftEye.x + rightEye.x) / 2,
            y: (leftEye.y + rightEye.y) / 2
        };

        // Check horizontal deviation
        const horizontalDeviation = Math.abs(noseTop.x - faceCenter.x);

        // Check vertical deviation (looking up/down)
        const verticalDeviation = Math.abs(noseTop.y - faceCenter.y);

        // If face is mostly centered, consider it eye contact
        return horizontalDeviation < 0.1 && verticalDeviation < 0.15;
    }
}

export default FaceAnalyzer;
