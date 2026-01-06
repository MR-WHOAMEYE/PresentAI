/**
 * Pose Analyzer
 * Uses MediaPipe Pose Landmarker for posture and gesture analysis
 * Enhanced with gesture classification and energy tracking
 */

import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';

export class PoseAnalyzer {
    constructor(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.poseLandmarker = null;
        this.drawingUtils = null;
        this.lastResults = null;

        // Gesture tracking
        this.gestureHistory = [];
        this.gestureHistoryLength = 30; // Track last 30 frames
        this.lastWristPositions = { left: null, right: null };

        // Energy tracking over time
        this.energyTimeline = [];
        this.sessionStartTime = null;
    }

    /**
     * Initialize the pose landmarker
     */
    async initialize() {
        this.sessionStartTime = Date.now();

        try {
            const vision = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
            );

            this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
                    delegate: 'GPU'
                },
                runningMode: 'VIDEO',
                numPoses: 1
            });

            this.drawingUtils = new DrawingUtils(this.ctx);
            console.log('Pose analyzer initialized');

        } catch (error) {
            console.error('Failed to initialize pose analyzer:', error);
            // Fallback to CPU if GPU fails
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
                );

                this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
                        delegate: 'CPU'
                    },
                    runningMode: 'VIDEO',
                    numPoses: 1
                });

                this.drawingUtils = new DrawingUtils(this.ctx);
                console.log('Pose analyzer initialized with CPU fallback');
            } catch (fallbackError) {
                console.error('Failed to initialize pose analyzer with CPU fallback:', fallbackError);
            }
        }
    }

    /**
     * Analyze current video frame
     */
    async analyze() {
        if (!this.poseLandmarker || this.video.readyState < 2) {
            return {
                postureScore: 0,
                gestureScore: 0,
                gestureType: 'none',
                gestureClassification: null,
                issues: []
            };
        }

        // Resize canvas to video dimensions
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;

        // Detect pose
        const startTime = performance.now();
        const results = this.poseLandmarker.detectForVideo(this.video, startTime);
        this.lastResults = results;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];

            // Draw pose
            this.drawPose(landmarks);

            // Analyze posture and gestures
            const analysis = this.analyzePosture(landmarks);

            // Track energy over time
            this.trackEnergy(analysis);

            return analysis;
        }

        return {
            postureScore: 0,
            gestureScore: 0,
            gestureType: 'none',
            gestureClassification: null,
            issues: ['No pose detected']
        };
    }

    /**
     * Draw pose landmarks on canvas
     */
    drawPose(landmarks) {
        if (!this.drawingUtils) return;

        // Draw connections
        const connections = PoseLandmarker.POSE_CONNECTIONS;

        this.ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
        this.ctx.lineWidth = 2;

        for (const connection of connections) {
            const start = landmarks[connection.start];
            const end = landmarks[connection.end];

            if (start.visibility > 0.5 && end.visibility > 0.5) {
                this.ctx.beginPath();
                this.ctx.moveTo(start.x * this.canvas.width, start.y * this.canvas.height);
                this.ctx.lineTo(end.x * this.canvas.width, end.y * this.canvas.height);
                this.ctx.stroke();
            }
        }

        // Draw landmarks
        for (const landmark of landmarks) {
            if (landmark.visibility > 0.5) {
                this.ctx.fillStyle = 'rgba(139, 92, 246, 0.8)';
                this.ctx.beginPath();
                this.ctx.arc(
                    landmark.x * this.canvas.width,
                    landmark.y * this.canvas.height,
                    4,
                    0,
                    2 * Math.PI
                );
                this.ctx.fill();
            }
        }
    }

    /**
     * Classify hand gesture type
     */
    classifyGesture(landmarks) {
        // Key landmark indices
        const LEFT_SHOULDER = 11;
        const RIGHT_SHOULDER = 12;
        const LEFT_ELBOW = 13;
        const RIGHT_ELBOW = 14;
        const LEFT_WRIST = 15;
        const RIGHT_WRIST = 16;
        const LEFT_HIP = 23;
        const RIGHT_HIP = 24;

        const leftWrist = landmarks[LEFT_WRIST];
        const rightWrist = landmarks[RIGHT_WRIST];
        const leftElbow = landmarks[LEFT_ELBOW];
        const rightElbow = landmarks[RIGHT_ELBOW];
        const leftShoulder = landmarks[LEFT_SHOULDER];
        const rightShoulder = landmarks[RIGHT_SHOULDER];
        const leftHip = landmarks[LEFT_HIP];
        const rightHip = landmarks[RIGHT_HIP];

        // Check visibility
        const leftVisible = leftWrist.visibility > 0.5 && leftElbow.visibility > 0.5;
        const rightVisible = rightWrist.visibility > 0.5 && rightElbow.visibility > 0.5;

        if (!leftVisible && !rightVisible) {
            return { type: 'hands_hidden', confidence: 0.5, description: 'Hands not visible' };
        }

        // Calculate movement from last frame
        let movement = 0;
        if (this.lastWristPositions.left && leftVisible) {
            movement += Math.hypot(
                leftWrist.x - this.lastWristPositions.left.x,
                leftWrist.y - this.lastWristPositions.left.y
            );
        }
        if (this.lastWristPositions.right && rightVisible) {
            movement += Math.hypot(
                rightWrist.x - this.lastWristPositions.right.x,
                rightWrist.y - this.lastWristPositions.right.y
            );
        }

        // Update last positions
        this.lastWristPositions.left = leftVisible ? { x: leftWrist.x, y: leftWrist.y } : null;
        this.lastWristPositions.right = rightVisible ? { x: rightWrist.x, y: rightWrist.y } : null;

        // Check for crossed arms
        if (leftVisible && rightVisible) {
            const armsCrossed = (leftWrist.x > rightWrist.x) &&
                (leftWrist.y < leftHip.y && rightWrist.y < rightHip.y) &&
                Math.abs(leftWrist.x - rightWrist.x) < 0.2;

            if (armsCrossed) {
                return { type: 'arms_crossed', confidence: 0.8, description: 'Arms crossed (defensive)' };
            }
        }

        // Check for nervous fidgeting (high movement, hands close together)
        if (movement > 0.05) {
            if (leftVisible && rightVisible) {
                const handsClose = Math.hypot(leftWrist.x - rightWrist.x, leftWrist.y - rightWrist.y) < 0.1;
                if (handsClose) {
                    return { type: 'fidgeting', confidence: 0.7, description: 'Nervous fidgeting' };
                }
            }
        }

        // Check for pointing gesture (one arm extended)
        if (leftVisible) {
            const leftArmExtended = Math.hypot(leftWrist.x - leftShoulder.x, leftWrist.y - leftShoulder.y) > 0.25;
            const leftElbowStraight = Math.abs(leftElbow.y - ((leftShoulder.y + leftWrist.y) / 2)) < 0.05;
            if (leftArmExtended && leftElbowStraight) {
                return { type: 'pointing', confidence: 0.75, description: 'Pointing gesture' };
            }
        }
        if (rightVisible) {
            const rightArmExtended = Math.hypot(rightWrist.x - rightShoulder.x, rightWrist.y - rightShoulder.y) > 0.25;
            const rightElbowStraight = Math.abs(rightElbow.y - ((rightShoulder.y + rightWrist.y) / 2)) < 0.05;
            if (rightArmExtended && rightElbowStraight) {
                return { type: 'pointing', confidence: 0.75, description: 'Pointing gesture' };
            }
        }

        // Check for open palms (hands at chest level, spread apart)
        if (leftVisible && rightVisible) {
            const handsAtChestLevel = leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y &&
                leftWrist.y > leftHip.y && rightWrist.y > rightHip.y;
            const handsSpreadApart = Math.abs(leftWrist.x - rightWrist.x) > 0.3;

            if (handsAtChestLevel && handsSpreadApart) {
                return { type: 'open_palms', confidence: 0.8, description: 'Open, expressive gestures' };
            }
        }

        // Check for hands behind back or at sides
        const handsDown = (leftVisible && leftWrist.y > leftHip.y) ||
            (rightVisible && rightWrist.y > rightHip.y);
        if (handsDown) {
            return { type: 'hands_down', confidence: 0.6, description: 'Hands at sides (neutral)' };
        }

        // Default: some movement
        if (movement > 0.02) {
            return { type: 'active_gesturing', confidence: 0.6, description: 'Active hand gestures' };
        }

        return { type: 'minimal', confidence: 0.5, description: 'Minimal gestures' };
    }

    /**
     * Track energy metrics over time
     */
    trackEnergy(analysis) {
        if (!this.sessionStartTime) return;

        const elapsedSeconds = (Date.now() - this.sessionStartTime) / 1000;

        // Record energy point every 30 seconds
        const lastRecordTime = this.energyTimeline.length > 0
            ? this.energyTimeline[this.energyTimeline.length - 1].time
            : 0;

        if (elapsedSeconds - lastRecordTime >= 30) {
            this.energyTimeline.push({
                time: Math.floor(elapsedSeconds),
                postureScore: analysis.postureScore,
                gestureScore: analysis.gestureScore,
                gestureType: analysis.gestureClassification?.type || 'unknown'
            });
        }
    }

    /**
     * Get energy analysis for session
     */
    getEnergyAnalysis() {
        if (this.energyTimeline.length < 2) {
            return { trend: 'insufficient_data', drops: [] };
        }

        const drops = [];
        for (let i = 1; i < this.energyTimeline.length; i++) {
            const prev = this.energyTimeline[i - 1];
            const curr = this.energyTimeline[i];

            const postureDropPercent = ((prev.postureScore - curr.postureScore) / prev.postureScore) * 100;
            const gestureDropPercent = ((prev.gestureScore - curr.gestureScore) / prev.gestureScore) * 100;

            if (postureDropPercent > 15 || gestureDropPercent > 20) {
                drops.push({
                    timeRange: `${Math.floor(prev.time / 60)}-${Math.floor(curr.time / 60)} min`,
                    type: postureDropPercent > gestureDropPercent ? 'posture' : 'gesture',
                    severity: Math.max(postureDropPercent, gestureDropPercent) > 25 ? 'significant' : 'moderate'
                });
            }
        }

        // Calculate overall trend
        const firstHalf = this.energyTimeline.slice(0, Math.floor(this.energyTimeline.length / 2));
        const secondHalf = this.energyTimeline.slice(Math.floor(this.energyTimeline.length / 2));

        const firstAvg = firstHalf.reduce((a, b) => a + b.postureScore + b.gestureScore, 0) / (firstHalf.length * 2);
        const secondAvg = secondHalf.reduce((a, b) => a + b.postureScore + b.gestureScore, 0) / (secondHalf.length * 2);

        let trend = 'stable';
        if (secondAvg < firstAvg - 10) trend = 'declining';
        else if (secondAvg > firstAvg + 10) trend = 'improving';

        return { trend, drops, timeline: this.energyTimeline };
    }

    /**
     * Analyze posture from landmarks
     */
    analyzePosture(landmarks) {
        const issues = [];
        let postureScore = 100;
        let gestureScore = 70;

        // Key landmark indices
        const NOSE = 0;
        const LEFT_SHOULDER = 11;
        const RIGHT_SHOULDER = 12;
        const LEFT_HIP = 23;
        const RIGHT_HIP = 24;

        // Check shoulder alignment
        const leftShoulder = landmarks[LEFT_SHOULDER];
        const rightShoulder = landmarks[RIGHT_SHOULDER];

        if (leftShoulder.visibility > 0.5 && rightShoulder.visibility > 0.5) {
            const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
            if (shoulderDiff > 0.03) {
                postureScore -= 15;
                issues.push('Uneven shoulders');
            }
        }

        // Check if leaning forward
        const nose = landmarks[NOSE];
        const midShoulder = {
            x: (leftShoulder.x + rightShoulder.x) / 2,
            y: (leftShoulder.y + rightShoulder.y) / 2
        };

        if (nose.visibility > 0.5 && leftShoulder.visibility > 0.5) {
            const leftHip = landmarks[LEFT_HIP];
            const rightHip = landmarks[RIGHT_HIP];

            if (leftHip.visibility > 0.5 && rightHip.visibility > 0.5) {
                const midHip = {
                    x: (leftHip.x + rightHip.x) / 2,
                    y: (leftHip.y + rightHip.y) / 2
                };

                const shoulderHipDiff = Math.abs(midShoulder.x - midHip.x);
                if (shoulderHipDiff > 0.1) {
                    postureScore -= 10;
                    issues.push('Leaning to the side');
                }
            }
        }

        // Check head position (looking down)
        if (nose.visibility > 0.5 && midShoulder.y > 0) {
            const headForwardRatio = (nose.y - midShoulder.y) / 0.2;
            if (headForwardRatio > 1.5) {
                postureScore -= 10;
                issues.push('Head tilted down');
            }
        }

        // Classify gesture type
        const gestureClassification = this.classifyGesture(landmarks);

        // Update gesture history
        this.gestureHistory.push(gestureClassification.type);
        if (this.gestureHistory.length > this.gestureHistoryLength) {
            this.gestureHistory.shift();
        }

        // Calculate gesture score based on classification
        switch (gestureClassification.type) {
            case 'open_palms':
            case 'active_gesturing':
                gestureScore = 90;
                break;
            case 'pointing':
                gestureScore = 75;
                break;
            case 'hands_down':
            case 'minimal':
                gestureScore = 55;
                issues.push('Try using more hand gestures');
                break;
            case 'arms_crossed':
                gestureScore = 40;
                issues.push('Arms crossed appears defensive');
                break;
            case 'fidgeting':
                gestureScore = 45;
                issues.push('Nervous fidgeting detected');
                break;
            case 'hands_hidden':
                gestureScore = 50;
                issues.push('Hands not visible');
                break;
            default:
                gestureScore = 60;
        }

        // Ensure scores are within bounds
        postureScore = Math.max(0, Math.min(100, postureScore));
        gestureScore = Math.max(0, Math.min(100, gestureScore));

        return {
            postureScore,
            gestureScore,
            gestureType: gestureClassification.description,
            gestureClassification,
            issues
        };
    }

    /**
     * Get gesture frequency stats
     */
    getGestureStats() {
        const counts = {};
        for (const gesture of this.gestureHistory) {
            counts[gesture] = (counts[gesture] || 0) + 1;
        }

        const total = this.gestureHistory.length;
        const stats = {};
        for (const [gesture, count] of Object.entries(counts)) {
            stats[gesture] = {
                count,
                percentage: Math.round((count / total) * 100)
            };
        }

        return stats;
    }
}

export default PoseAnalyzer;
