/**
 * Face Analyzer v2.0
 * Uses MediaPipe Face Landmarker for audience engagement tracking via head pose detection
 * 
 * IMPROVED ACCURACY FEATURES:
 * - Uses 3D transformation matrices when available for accurate pose estimation
 * - Adaptive smoothing based on movement speed
 * - Timestamp-based engagement window (independent of frame rate)
 * - Confidence-weighted scoring
 * - Dynamic threshold adjustment based on calibration
 * 
 * Engagement Logic:
 * - Good engagement: Yaw angle > threshold (side profile visible, facing audience)
 * - Bad engagement: Yaw angle < lower threshold (frontal view to camera, looking at slides)
 * - Neutral zone: Transitioning between states
 * - Also tracks pitch to detect looking down at screen
 */

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export class FaceAnalyzer {
    constructor(videoElement, options = {}) {
        this.video = videoElement;
        this.faceLandmarker = null;
        this.lastResults = null;

        // Configurable options with defaults
        const {
            historyMs = 2000,           // Engagement window in milliseconds
            baseSmoothingFactor = 0.35, // Base EMA alpha
            goodYawThreshold = 20,      // Lower = more sensitive to engagement
            badYawThreshold = 12,       // Lower = more lenient
            badPitchThreshold = -12,    // Looking down threshold
            goodPitchThreshold = 15,    // Looking up too much
        } = options;

        // Timestamp-based engagement tracking
        this.engagementSamples = [];  // {timestamp, score, confidence}
        this.historyMs = historyMs;

        // Head pose smoothing with adaptive alpha
        this.smoothedYaw = 0;
        this.smoothedPitch = 0;
        this.smoothedRoll = 0;
        this.baseSmoothingFactor = baseSmoothingFactor;
        this.lastRawYaw = 0;
        this.lastRawPitch = 0;

        // Engagement thresholds (configurable)
        this.GOOD_YAW_THRESHOLD = goodYawThreshold;
        this.BAD_YAW_THRESHOLD = badYawThreshold;
        this.BAD_PITCH_THRESHOLD = badPitchThreshold;
        this.GOOD_PITCH_THRESHOLD = goodPitchThreshold;

        // Calibration (auto-calibrates on first few frames)
        this.yawCalibrationOffset = 0;
        this.pitchCalibrationOffset = 0;
        this.calibrationSamples = [];
        this.isCalibrated = false;
        this.CALIBRATION_FRAMES = 30; // Frames to use for calibration

        // Stats tracking with timestamps
        this.poseHistory = [];
        this.maxPoseHistory = 300;

        // Confidence tracking
        this.lastConfidence = 0;
        this.faceDetectionStreak = 0;
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
                outputFaceBlendshapes: true,
                outputFacialTransformationMatrixes: true // Enable 3D pose output
            });

            console.log('Face analyzer initialized with head pose detection');

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
                    outputFaceBlendshapes: true,
                    outputFacialTransformationMatrixes: true
                });

                console.log('Face analyzer initialized with CPU fallback');
            } catch (fallbackError) {
                console.error('Failed to initialize face analyzer with CPU fallback:', fallbackError);
            }
        }
    }

    /**
     * Extract yaw, pitch, roll from 3D transformation matrix (more accurate)
     */
    extractPoseFromMatrix(matrix) {
        // Matrix is a 4x4 transformation matrix in row-major order
        // Extract rotation angles using standard rotation matrix decomposition
        const m = matrix.data;

        // Extract rotation components (assuming row-major 4x4 matrix)
        const r00 = m[0], r01 = m[1], r02 = m[2];
        const r10 = m[4], r11 = m[5], r12 = m[6];
        const r20 = m[8], r21 = m[9], r22 = m[10];

        // Compute Euler angles (in degrees)
        let pitch, yaw, roll;

        if (Math.abs(r20) < 0.999) {
            pitch = Math.asin(-r20) * (180 / Math.PI);
            yaw = Math.atan2(r21, r22) * (180 / Math.PI);
            roll = Math.atan2(r10, r00) * (180 / Math.PI);
        } else {
            // Gimbal lock case
            pitch = r20 < 0 ? 90 : -90;
            yaw = 0;
            roll = Math.atan2(-r01, r11) * (180 / Math.PI);
        }

        return { yaw, pitch, roll };
    }

    /**
     * Extract yaw, pitch, roll from face landmarks using geometric approach
     * Enhanced with multiple cues and better weighting
     */
    extractHeadPoseFromLandmarks(landmarks) {
        // Key landmarks for head pose estimation
        const noseTip = landmarks[1];       // Nose tip
        const noseBase = landmarks[168];    // Between eyes (nose bridge)
        const leftEyeOuter = landmarks[33]; // Left eye outer corner
        const rightEyeOuter = landmarks[263]; // Right eye outer corner
        const leftEyeInner = landmarks[133]; // Left eye inner corner
        const rightEyeInner = landmarks[362]; // Right eye inner corner
        const leftMouth = landmarks[61];    // Left mouth corner
        const rightMouth = landmarks[291];  // Right mouth corner
        const chin = landmarks[152];        // Chin
        const forehead = landmarks[10];     // Forehead center
        const leftCheek = landmarks[234];   // Left cheek
        const rightCheek = landmarks[454];  // Right cheek

        // Calculate face dimensions for normalization
        const faceWidth = Math.abs(rightEyeOuter.x - leftEyeOuter.x);
        const faceHeight = Math.abs(chin.y - forehead.y);

        // Guard against bad landmarks
        if (faceWidth < 0.01 || faceHeight < 0.01) {
            return { yaw: 0, pitch: 0, roll: 0, confidence: 0 };
        }

        // --- YAW (left-right rotation) - IMPROVED ---
        const eyeCenterX = (leftEyeOuter.x + rightEyeOuter.x) / 2;
        const noseDeviationX = noseTip.x - eyeCenterX;

        // Eye asymmetry (very reliable)
        const leftEyeWidth = Math.abs(leftEyeInner.x - leftEyeOuter.x);
        const rightEyeWidth = Math.abs(rightEyeInner.x - rightEyeOuter.x);
        const eyeWidthRatio = leftEyeWidth / (rightEyeWidth + 0.001);

        // Cheek depth difference (uses Z coordinate)
        let cheekZDiff = 0;
        if (leftCheek.z !== undefined && rightCheek.z !== undefined) {
            cheekZDiff = (rightCheek.z - leftCheek.z) * 150;
        }

        // Face side ratio
        const leftSideWidth = eyeCenterX - leftEyeOuter.x;
        const rightSideWidth = rightEyeOuter.x - eyeCenterX;
        const sideRatio = leftSideWidth / (rightSideWidth + 0.001);

        // Nose Z position relative to eyes
        let noseZContrib = 0;
        if (noseTip.z !== undefined && leftEyeOuter.z !== undefined && rightEyeOuter.z !== undefined) {
            const avgEyeZ = (leftEyeOuter.z + rightEyeOuter.z) / 2;
            const noseProtrusion = noseTip.z - avgEyeZ;
            // More protruding nose = more frontal
            noseZContrib = noseProtrusion * 50;
        }

        // Combine all yaw cues with learned weights
        const yawFromNose = (noseDeviationX / faceWidth) * 85;
        const yawFromEyeRatio = (eyeWidthRatio - 1) * 40;
        const yawFromSideRatio = (sideRatio - 1) * 35;

        // Weighted combination (prioritize most reliable cues)
        const rawYaw = (
            yawFromNose * 0.30 +
            yawFromEyeRatio * 0.25 +
            cheekZDiff * 0.25 +
            yawFromSideRatio * 0.20
        );

        // --- PITCH (up-down rotation) - IMPROVED ---
        const expectedNoseY = forehead.y + (chin.y - forehead.y) * 0.4; // Nose is typically 40% down
        const noseDeviationY = noseTip.y - expectedNoseY;

        // Forehead to chin ratio changes with pitch
        const noseToForehead = Math.abs(noseTip.y - forehead.y);
        const noseToChin = Math.abs(chin.y - noseTip.y);
        const verticalRatio = noseToForehead / (noseToChin + 0.001);

        // Eye to nose bridge distance changes with pitch
        const eyeLevel = (leftEyeOuter.y + rightEyeOuter.y) / 2;
        const eyeToNose = noseTip.y - eyeLevel;
        const normalizedEyeToNose = eyeToNose / faceHeight;

        const pitchFromNose = (noseDeviationY / faceHeight) * 55;
        const pitchFromRatio = (verticalRatio - 0.67) * 45; // 0.67 is neutral ratio
        const pitchFromEyeNose = (normalizedEyeToNose - 0.15) * 60;

        const rawPitch = (
            pitchFromNose * 0.35 +
            pitchFromRatio * 0.35 +
            pitchFromEyeNose * 0.30
        );

        // --- ROLL (tilt) ---
        const eyeTilt = (rightEyeOuter.y - leftEyeOuter.y) / faceWidth;
        const mouthTilt = (rightMouth.y - leftMouth.y) / faceWidth;
        const rawRoll = ((eyeTilt * 0.6 + mouthTilt * 0.4)) * 85;

        // Calculate confidence based on face landmark consistency
        const faceAspectRatio = faceWidth / faceHeight;
        const expectedAspectRatio = 0.65; // Typical face aspect ratio
        const aspectConfidence = 1 - Math.min(1, Math.abs(faceAspectRatio - expectedAspectRatio) / 0.3);

        const confidence = aspectConfidence * 0.7 + 0.3; // Base confidence of 30%

        return {
            yaw: rawYaw,
            pitch: rawPitch,
            roll: rawRoll,
            confidence
        };
    }

    /**
     * Main head pose extraction with matrix preference and adaptive smoothing
     */
    extractHeadPose(landmarks, matrices = null) {
        let rawPose;
        let confidence = 0.5;

        // Prefer 3D transformation matrix if available (more accurate)
        if (matrices && matrices.length > 0 && matrices[0]?.data) {
            rawPose = this.extractPoseFromMatrix(matrices[0]);
            confidence = 0.9; // High confidence with matrix
        } else {
            // Fall back to geometric approach
            const landmarkPose = this.extractHeadPoseFromLandmarks(landmarks);
            rawPose = landmarkPose;
            confidence = landmarkPose.confidence || 0.5;
        }

        // Auto-calibration during first frames
        if (!this.isCalibrated && this.calibrationSamples.length < this.CALIBRATION_FRAMES) {
            this.calibrationSamples.push({ yaw: rawPose.yaw, pitch: rawPose.pitch });
            if (this.calibrationSamples.length === this.CALIBRATION_FRAMES) {
                // Calculate median for calibration (robust to outliers)
                const sortedYaw = this.calibrationSamples.map(s => s.yaw).sort((a, b) => a - b);
                const sortedPitch = this.calibrationSamples.map(s => s.pitch).sort((a, b) => a - b);
                this.yawCalibrationOffset = sortedYaw[Math.floor(sortedYaw.length / 2)];
                this.pitchCalibrationOffset = sortedPitch[Math.floor(sortedPitch.length / 2)];
                this.isCalibrated = true;
                console.log('Face analyzer calibrated:', { yawOffset: this.yawCalibrationOffset, pitchOffset: this.pitchCalibrationOffset });
            }
        }

        // Apply calibration offset
        const calibratedYaw = rawPose.yaw - this.yawCalibrationOffset;
        const calibratedPitch = rawPose.pitch - this.pitchCalibrationOffset;

        // Adaptive smoothing - less smoothing when head moves fast for responsiveness
        const yawDelta = Math.abs(calibratedYaw - this.lastRawYaw);
        const pitchDelta = Math.abs(calibratedPitch - this.lastRawPitch);
        const movementSpeed = Math.max(yawDelta, pitchDelta);

        // Increase alpha (less smoothing) when moving fast
        let adaptiveAlpha = this.baseSmoothingFactor;
        if (movementSpeed > 5) {
            adaptiveAlpha = Math.min(0.7, this.baseSmoothingFactor + movementSpeed * 0.02);
        }

        // Apply EMA with adaptive alpha
        this.smoothedYaw = adaptiveAlpha * calibratedYaw + (1 - adaptiveAlpha) * this.smoothedYaw;
        this.smoothedPitch = adaptiveAlpha * calibratedPitch + (1 - adaptiveAlpha) * this.smoothedPitch;
        this.smoothedRoll = adaptiveAlpha * rawPose.roll + (1 - adaptiveAlpha) * this.smoothedRoll;

        // Store for next frame
        this.lastRawYaw = calibratedYaw;
        this.lastRawPitch = calibratedPitch;
        this.lastConfidence = confidence;

        return {
            yaw: this.smoothedYaw,
            pitch: this.smoothedPitch,
            roll: this.smoothedRoll,
            raw: { yaw: rawPose.yaw, pitch: rawPose.pitch, roll: rawPose.roll },
            confidence,
            isCalibrated: this.isCalibrated
        };
    }

    /**
     * Determine engagement level based on head pose with confidence weighting
     * Returns: 'good', 'neutral', or 'bad' with detailed scoring
     */
    calculateEngagement(headPose) {
        const absYaw = Math.abs(headPose.yaw);
        const pitch = headPose.pitch;
        const confidence = headPose.confidence || 0.5;

        // Low confidence = uncertain, return neutral
        if (confidence < 0.3) {
            return {
                level: 'neutral',
                reason: 'Low confidence detection',
                score: 50,
                confidence
            };
        }

        // Check if looking up too much (also not ideal)
        if (pitch > this.GOOD_PITCH_THRESHOLD) {
            return {
                level: 'neutral',
                reason: 'Looking up',
                score: 60,
                confidence
            };
        }

        // Check if looking down at screen/notes (bad regardless of yaw)
        if (pitch < this.BAD_PITCH_THRESHOLD) {
            const pitchSeverity = Math.min(1, Math.abs(pitch - this.BAD_PITCH_THRESHOLD) / 20);
            return {
                level: 'bad',
                reason: 'Looking down at notes',
                score: Math.round(40 - pitchSeverity * 20),
                confidence
            };
        }

        // Check yaw for audience engagement
        if (absYaw >= this.GOOD_YAW_THRESHOLD) {
            // Side profile visible - facing audience
            // Score increases with more yaw (more clearly facing audience)
            const yawBonus = Math.min(10, (absYaw - this.GOOD_YAW_THRESHOLD) / 2);
            return {
                level: 'good',
                reason: 'Engaging audience',
                score: Math.round(90 + yawBonus),
                confidence
            };
        } else if (absYaw < this.BAD_YAW_THRESHOLD) {
            // Frontal view - likely looking at slides/screen
            // Score decreases the more frontal they are
            const frontalPenalty = Math.min(20, (this.BAD_YAW_THRESHOLD - absYaw) * 2);
            return {
                level: 'bad',
                reason: 'Facing camera/slides',
                score: Math.round(45 - frontalPenalty),
                confidence
            };
        } else {
            // Neutral zone (transitioning between audience and slides)
            const progress = (absYaw - this.BAD_YAW_THRESHOLD) /
                (this.GOOD_YAW_THRESHOLD - this.BAD_YAW_THRESHOLD);
            const transitionScore = 50 + progress * 40;
            return {
                level: 'neutral',
                reason: 'Transitioning',
                score: Math.round(transitionScore),
                confidence
            };
        }
    }

    /**
     * Record engagement sample with timestamp (for time-based averaging)
     */
    recordEngagement(score, confidence) {
        const now = performance.now();
        this.engagementSamples.push({ ts: now, score, confidence });

        // Prune old samples outside the time window
        const cutoff = now - this.historyMs;
        while (this.engagementSamples.length > 0 && this.engagementSamples[0].ts < cutoff) {
            this.engagementSamples.shift();
        }
    }

    /**
     * Calculate weighted average engagement (confidence-weighted)
     */
    getWeightedEngagementPercent() {
        if (this.engagementSamples.length === 0) return 0;

        let totalWeight = 0;
        let weightedSum = 0;

        for (const sample of this.engagementSamples) {
            const weight = sample.confidence || 0.5;
            weightedSum += sample.score * weight;
            totalWeight += weight;
        }

        return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
    }

    /**
     * Analyze current video frame
     */
    async analyze() {
        if (!this.faceLandmarker || this.video.readyState < 2) {
            this.faceDetectionStreak = 0;
            return {
                eyeContactPercent: this.getWeightedEngagementPercent(),
                isLookingAtCamera: false,
                headPose: { yaw: 0, pitch: 0, roll: 0 },
                engagement: { level: 'unknown', reason: 'No face detected', score: 0, confidence: 0 },
                faceDetected: false
            };
        }

        const startTime = performance.now();
        const results = this.faceLandmarker.detectForVideo(this.video, startTime);
        this.lastResults = results;

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            const landmarks = results.faceLandmarks[0];
            const matrices = results.facialTransformationMatrixes;

            this.faceDetectionStreak++;

            // Extract head pose (uses 3D matrix when available)
            const headPose = this.extractHeadPose(landmarks, matrices);

            // Calculate engagement based on head pose
            const engagement = this.calculateEngagement(headPose);

            // Store pose history for analytics
            this.poseHistory.push({
                timestamp: Date.now(),
                yaw: headPose.yaw,
                pitch: headPose.pitch,
                roll: headPose.roll,
                engagement: engagement.level,
                confidence: headPose.confidence
            });
            if (this.poseHistory.length > this.maxPoseHistory) {
                this.poseHistory.shift();
            }

            // Record timestamp-based engagement (confidence-weighted)
            this.recordEngagement(engagement.score, headPose.confidence);

            // Calculate weighted engagement percentage
            const eyeContactPercent = this.getWeightedEngagementPercent();

            // For backward compatibility: "isLookingAtCamera" now means "good engagement"
            const isLookingAtCamera = engagement.level === 'good';

            return {
                eyeContactPercent,
                isLookingAtCamera,
                headPose: {
                    yaw: Math.round(headPose.yaw * 10) / 10,
                    pitch: Math.round(headPose.pitch * 10) / 10,
                    roll: Math.round(headPose.roll * 10) / 10,
                    confidence: Math.round(headPose.confidence * 100)
                },
                engagement,
                faceDetected: true,
                isCalibrated: headPose.isCalibrated,
                debug: {
                    absYaw: Math.abs(headPose.yaw),
                    rawYaw: headPose.raw?.yaw,
                    rawPitch: headPose.raw?.pitch,
                    calibrationOffset: {
                        yaw: this.yawCalibrationOffset,
                        pitch: this.pitchCalibrationOffset
                    },
                    thresholds: {
                        good: this.GOOD_YAW_THRESHOLD,
                        bad: this.BAD_YAW_THRESHOLD,
                        pitchBad: this.BAD_PITCH_THRESHOLD
                    },
                    faceDetectionStreak: this.faceDetectionStreak,
                    samplesInWindow: this.engagementSamples.length
                }
            };
        }

        // No face detected this frame
        this.faceDetectionStreak = 0;
        return {
            eyeContactPercent: this.getWeightedEngagementPercent(),
            isLookingAtCamera: false,
            headPose: { yaw: 0, pitch: 0, roll: 0, confidence: 0 },
            engagement: { level: 'unknown', reason: 'No face detected', score: 0, confidence: 0 },
            faceDetected: false
        };
    }

    /**
     * Recalibrate the analyzer (call when user is facing forward)
     */
    recalibrate() {
        this.isCalibrated = false;
        this.calibrationSamples = [];
        this.yawCalibrationOffset = 0;
        this.pitchCalibrationOffset = 0;
        console.log('Face analyzer recalibration started');
    }

    /**
     * Update thresholds dynamically
     */
    setThresholds({ goodYaw, badYaw, badPitch, goodPitch }) {
        if (goodYaw !== undefined) this.GOOD_YAW_THRESHOLD = goodYaw;
        if (badYaw !== undefined) this.BAD_YAW_THRESHOLD = badYaw;
        if (badPitch !== undefined) this.BAD_PITCH_THRESHOLD = badPitch;
        if (goodPitch !== undefined) this.GOOD_PITCH_THRESHOLD = goodPitch;
    }

    /**
     * Get engagement statistics for the session
     */
    getEngagementStats() {
        if (this.poseHistory.length === 0) {
            return {
                goodPercent: 0,
                neutralPercent: 0,
                badPercent: 0,
                averageYaw: 0,
                averagePitch: 0
            };
        }

        const counts = { good: 0, neutral: 0, bad: 0 };
        let totalYaw = 0;
        let totalPitch = 0;

        for (const pose of this.poseHistory) {
            counts[pose.engagement] = (counts[pose.engagement] || 0) + 1;
            totalYaw += Math.abs(pose.yaw);
            totalPitch += pose.pitch;
        }

        const total = this.poseHistory.length;

        return {
            goodPercent: Math.round((counts.good / total) * 100),
            neutralPercent: Math.round((counts.neutral / total) * 100),
            badPercent: Math.round((counts.bad / total) * 100),
            averageYaw: Math.round(totalYaw / total),
            averagePitch: Math.round(totalPitch / total),
            totalSamples: total
        };
    }

    /**
     * Legacy method for backward compatibility
     */
    checkEyeContact(landmarks, blendshapes) {
        const headPose = this.extractHeadPose(landmarks);
        const engagement = this.calculateEngagement(headPose);
        return engagement.level === 'good';
    }
}

export default FaceAnalyzer;
