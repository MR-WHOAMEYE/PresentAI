/**
 * Presentation Coach - Main Application Entry Point
 * AI-powered presentation coaching assistant
 */

import { ApiService } from './services/ApiService.js';
import { AuthService } from './services/AuthService.js';
import { PoseAnalyzer } from './analyzers/PoseAnalyzer.js';
import { FaceAnalyzer } from './analyzers/FaceAnalyzer.js';
import { SpeechAnalyzer } from './analyzers/SpeechAnalyzer.js';
import { RecordingService } from './services/RecordingService.js';

// Global state
const state = {
    currentPage: 'dashboard',
    isAuthenticated: false,
    user: null,
    currentSession: null,
    currentPresentation: null,
    currentSlideIndex: 0,
    isRecording: false,
    isPracticing: false,
    mediaStream: null,
    metrics: {
        postureScore: 0,
        eyeContactPercent: 0,
        gestureScore: 0,
        speechRate: 0,
        fillerCount: 0,
        fillerWords: []
    },
    sessionMetrics: [],
    transcript: ''
};

// Initialize services
const apiService = new ApiService();
const authService = new AuthService(apiService);
let poseAnalyzer = null;
let faceAnalyzer = null;
let speechAnalyzer = null;
let recordingService = null;

// DOM Elements
const elements = {
    // Navigation
    navLinks: document.querySelectorAll('.nav-link'),
    loginBtn: document.getElementById('loginBtn'),
    navUser: document.getElementById('navUser'),

    // Pages
    dashboardPage: document.getElementById('dashboardPage'),
    practicePage: document.getElementById('practicePage'),
    feedbackPage: document.getElementById('feedbackPage'),
    progressPage: document.getElementById('progressPage'),
    settingsPage: document.getElementById('settingsPage'),

    // Dashboard
    totalSessions: document.getElementById('totalSessions'),
    totalTime: document.getElementById('totalTime'),
    avgScore: document.getElementById('avgScore'),
    trend: document.getElementById('trend'),
    startPracticeBtn: document.getElementById('startPracticeBtn'),
    importSlidesBtn: document.getElementById('importSlidesBtn'),
    recentSessions: document.getElementById('recentSessions'),

    // Practice
    videoPreview: document.getElementById('videoPreview'),
    poseCanvas: document.getElementById('poseCanvas'),
    toggleCamera: document.getElementById('toggleCamera'),
    toggleMic: document.getElementById('toggleMic'),
    toggleRecording: document.getElementById('toggleRecording'),
    recordingIndicator: document.getElementById('recordingIndicator'),
    recTime: document.getElementById('recTime'),
    slideViewer: document.getElementById('slideViewer'),
    slideDisplay: document.getElementById('slideDisplay'),
    prevSlide: document.getElementById('prevSlide'),
    nextSlide: document.getElementById('nextSlide'),
    currentSlide: document.getElementById('currentSlide'),
    totalSlides: document.getElementById('totalSlides'),
    speakerNotes: document.getElementById('speakerNotes'),
    aiFeedbackContent: document.getElementById('aiFeedbackContent'),
    confidenceScore: document.getElementById('confidenceScore'),
    transcriptContent: document.getElementById('transcriptContent'),
    fillerCount: document.getElementById('fillerCount'),
    endSessionBtn: document.getElementById('endSessionBtn'),

    // Feedback
    finalScore: document.getElementById('finalScore'),
    scoreMessage: document.getElementById('scoreMessage'),
    strengthsList: document.getElementById('strengthsList'),
    improvementsList: document.getElementById('improvementsList'),
    goalsList: document.getElementById('goalsList'),
    playbackVideo: document.getElementById('playbackVideo'),
    saveToSlidesBtn: document.getElementById('saveToSlidesBtn'),
    newSessionBtn: document.getElementById('newSessionBtn'),
    backToDashboardBtn: document.getElementById('backToDashboardBtn'),

    // Settings
    profileAvatar: document.getElementById('profileAvatar'),
    profileName: document.getElementById('profileName'),
    profileEmail: document.getElementById('profileEmail'),
    connectGoogleBtn: document.getElementById('connectGoogleBtn'),

    // Modal
    presentationModal: document.getElementById('presentationModal'),
    closeModal: document.getElementById('closeModal'),
    presentationSearch: document.getElementById('presentationSearch'),
    presentationsGrid: document.getElementById('presentationsGrid'),

    // Toast
    toastContainer: document.getElementById('toastContainer')
};

/**
 * Initialize the application
 */
async function init() {
    console.log('🎤 Presentation Coach initializing...');

    // Check URL parameters for auth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth') === 'success') {
        showToast('Successfully connected to Google!', 'success');
        window.history.replaceState({}, '', window.location.pathname);
    } else if (urlParams.get('error')) {
        showToast('Authentication failed. Please try again.', 'error');
        window.history.replaceState({}, '', window.location.pathname);
    }

    // Check authentication status
    await checkAuthStatus();

    // Setup event listeners
    setupEventListeners();

    // Load initial data
    if (state.isAuthenticated) {
        await loadDashboardData();
    }

    console.log('✅ Presentation Coach ready!');
}

/**
 * Check authentication status
 */
async function checkAuthStatus() {
    try {
        const response = await authService.checkStatus();
        state.isAuthenticated = response.authenticated;
        state.user = response.user;
        updateAuthUI();
    } catch (error) {
        console.error('Auth check failed:', error);
        state.isAuthenticated = false;
        state.user = null;
    }
}

/**
 * Update UI based on authentication state
 */
function updateAuthUI() {
    if (state.isAuthenticated && state.user) {
        elements.loginBtn.innerHTML = `
            <img src="${state.user.picture || ''}" alt="" class="user-avatar-img" style="width: 24px; height: 24px; border-radius: 50%;">
            <span>${state.user.name || state.user.email}</span>
        `;
        elements.loginBtn.classList.add('authenticated');

        // Update settings page
        if (state.user.picture) {
            elements.profileAvatar.innerHTML = `<img src="${state.user.picture}" alt="">`;
        }
        elements.profileName.textContent = state.user.name || 'User';
        elements.profileEmail.textContent = state.user.email;
        elements.connectGoogleBtn.textContent = 'Disconnect';
    } else {
        elements.loginBtn.innerHTML = `
            <span class="btn-icon">🔗</span>
            Connect Google
        `;
        elements.loginBtn.classList.remove('authenticated');
    }
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Navigation
    elements.navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            navigateTo(page);
        });
    });

    // Auth
    elements.loginBtn.addEventListener('click', handleAuth);
    elements.connectGoogleBtn.addEventListener('click', handleAuth);

    // Dashboard actions
    elements.startPracticeBtn.addEventListener('click', startPractice);
    elements.importSlidesBtn.addEventListener('click', openPresentationPicker);

    // Practice controls
    elements.toggleCamera.addEventListener('click', toggleCamera);
    elements.toggleMic.addEventListener('click', toggleMic);
    elements.toggleRecording.addEventListener('click', toggleRecording);
    elements.endSessionBtn.addEventListener('click', endSession);
    elements.prevSlide.addEventListener('click', () => changeSlide(-1));
    elements.nextSlide.addEventListener('click', () => changeSlide(1));

    // Feedback actions
    elements.saveToSlidesBtn.addEventListener('click', saveToSlides);
    elements.newSessionBtn.addEventListener('click', startPractice);
    elements.backToDashboardBtn.addEventListener('click', () => navigateTo('dashboard'));

    // Modal
    elements.closeModal.addEventListener('click', closePresentationPicker);
    elements.presentationModal.addEventListener('click', (e) => {
        if (e.target === elements.presentationModal) {
            closePresentationPicker();
        }
    });
    elements.presentationSearch.addEventListener('input', filterPresentations);

    // Settings
    document.getElementById('targetWpm').addEventListener('input', (e) => {
        document.getElementById('targetWpmValue').textContent = e.target.value;
    });
}

/**
 * Navigate to a page
 */
function navigateTo(page) {
    state.currentPage = page;

    // Update nav links
    elements.navLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
    });

    // Show/hide pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageElement = document.getElementById(`${page}Page`);
    if (pageElement) {
        pageElement.classList.add('active');
    }

    // Page-specific logic
    if (page === 'dashboard' && state.isAuthenticated) {
        loadDashboardData();
    } else if (page === 'progress' && state.isAuthenticated) {
        loadProgressData();
    }
}

/**
 * Handle authentication
 */
function handleAuth() {
    if (state.isAuthenticated) {
        authService.logout().then(() => {
            state.isAuthenticated = false;
            state.user = null;
            updateAuthUI();
            showToast('Logged out successfully', 'info');
        });
    } else {
        authService.login();
    }
}

/**
 * Load dashboard data
 */
async function loadDashboardData() {
    try {
        const stats = await apiService.get('/sessions/stats');

        elements.totalSessions.textContent = stats.totalSessions || 0;
        elements.totalTime.textContent = formatDuration(stats.totalPracticeTime || 0);
        elements.avgScore.textContent = stats.averageScore || '--';

        const trendEmoji = {
            'improving': '↗',
            'declining': '↘',
            'neutral': '→'
        };
        elements.trend.textContent = trendEmoji[stats.recentTrend] || '→';
        elements.trend.className = `stat-value trend-${stats.recentTrend}`;

        // Load recent sessions
        const sessionsResponse = await apiService.get('/sessions');
        renderRecentSessions(sessionsResponse.sessions?.slice(0, 5) || []);

    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
}

/**
 * Render recent sessions
 */
function renderRecentSessions(sessions) {
    if (sessions.length === 0) {
        elements.recentSessions.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📝</span>
                <p>No practice sessions yet. Start your first practice!</p>
            </div>
        `;
        return;
    }

    elements.recentSessions.innerHTML = sessions.map(session => `
        <div class="session-item" data-id="${session.id}">
            <div class="session-info">
                <span class="session-title">${session.presentationTitle || 'Practice Session'}</span>
                <span class="session-date">${formatDate(session.startedAt)}</span>
            </div>
            <span class="session-score">${session.overallScore || '--'}</span>
        </div>
    `).join('');
}

/**
 * Open presentation picker modal
 */
async function openPresentationPicker() {
    if (!state.isAuthenticated) {
        showToast('Please connect your Google account first', 'info');
        handleAuth();
        return;
    }

    elements.presentationModal.classList.add('active');

    try {
        const response = await apiService.get('/presentations');
        renderPresentations(response.presentations || []);
    } catch (error) {
        console.error('Failed to load presentations:', error);
        elements.presentationsGrid.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">❌</span>
                <p>Failed to load presentations. Please try again.</p>
            </div>
        `;
    }
}

/**
 * Render presentations in modal
 */
function renderPresentations(presentations) {
    if (presentations.length === 0) {
        elements.presentationsGrid.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📊</span>
                <p>No presentations found in your Google Slides.</p>
            </div>
        `;
        return;
    }

    elements.presentationsGrid.innerHTML = presentations.map(pres => `
        <div class="presentation-card" data-id="${pres.id}" data-title="${pres.title}">
            <div class="presentation-thumbnail">
                ${pres.thumbnailUrl ? `<img src="${pres.thumbnailUrl}" alt="${pres.title}">` : '<span>📊</span>'}
            </div>
            <div class="presentation-info">
                <p class="presentation-title">${pres.title}</p>
                <p class="presentation-date">${formatDate(pres.lastModified)}</p>
            </div>
        </div>
    `).join('');

    // Add click handlers
    document.querySelectorAll('.presentation-card').forEach(card => {
        card.addEventListener('click', () => selectPresentation(card.dataset.id, card.dataset.title));
    });
}

/**
 * Filter presentations
 */
function filterPresentations() {
    const query = elements.presentationSearch.value.toLowerCase();
    document.querySelectorAll('.presentation-card').forEach(card => {
        const title = card.dataset.title.toLowerCase();
        card.style.display = title.includes(query) ? 'block' : 'none';
    });
}

/**
 * Select a presentation
 */
async function selectPresentation(id, title) {
    closePresentationPicker();
    showToast(`Loading "${title}"...`, 'info');

    try {
        const presentation = await apiService.get(`/presentations/${id}`);
        state.currentPresentation = presentation;
        state.currentSlideIndex = 0;

        showToast(`Loaded "${title}" with ${presentation.slideCount} slides`, 'success');
        updateSlideDisplay();
    } catch (error) {
        console.error('Failed to load presentation:', error);
        showToast('Failed to load presentation', 'error');
    }
}

/**
 * Close presentation picker
 */
function closePresentationPicker() {
    elements.presentationModal.classList.remove('active');
}

/**
 * Update slide display
 */
function updateSlideDisplay() {
    if (!state.currentPresentation) {
        elements.slideDisplay.innerHTML = `
            <div class="no-slides">
                <span class="slide-placeholder-icon">📑</span>
                <p>Import a presentation to see slides here</p>
            </div>
        `;
        return;
    }

    const slides = state.currentPresentation.slides;
    const currentSlide = slides[state.currentSlideIndex];

    elements.currentSlide.textContent = state.currentSlideIndex + 1;
    elements.totalSlides.textContent = slides.length;

    // Show thumbnail image if available, otherwise show text content
    if (currentSlide?.thumbnailUrl) {
        elements.slideDisplay.innerHTML = `
            <img src="${currentSlide.thumbnailUrl}" alt="Slide ${state.currentSlideIndex + 1}" class="slide-thumbnail-img">
        `;
    } else {
        elements.slideDisplay.innerHTML = `
            <div class="slide-content-preview">
                <h3>${currentSlide?.textContent?.substring(0, 200) || 'Slide ' + (state.currentSlideIndex + 1)}</h3>
            </div>
        `;
    }

    // Update speaker notes
    const notesContent = elements.speakerNotes.querySelector('.notes-content');
    notesContent.textContent = currentSlide?.speakerNotes || 'No speaker notes for this slide.';
}

/**
 * Change slide
 */
function changeSlide(direction) {
    if (!state.currentPresentation) return;

    const newIndex = state.currentSlideIndex + direction;
    const maxIndex = state.currentPresentation.slides.length - 1;

    if (newIndex >= 0 && newIndex <= maxIndex) {
        state.currentSlideIndex = newIndex;
        updateSlideDisplay();
    }
}

/**
 * Start practice session
 */
async function startPractice() {
    navigateTo('practice');

    try {
        // Request camera and microphone
        state.mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720, facingMode: 'user' },
            audio: true
        });

        elements.videoPreview.srcObject = state.mediaStream;

        // Initialize analyzers
        await initializeAnalyzers();

        // Create session on backend
        if (state.isAuthenticated) {
            const sessionResponse = await apiService.post('/sessions', {
                presentationId: state.currentPresentation?.id,
                presentationTitle: state.currentPresentation?.title
            });
            state.currentSession = sessionResponse.session;
        }

        state.isPracticing = true;
        showToast('Practice session started!', 'success');

        // Start analysis loop
        startAnalysisLoop();

    } catch (error) {
        console.error('Failed to start practice:', error);
        showToast('Failed to access camera/microphone. Please check permissions.', 'error');
    }
}

/**
 * Initialize ML analyzers
 */
async function initializeAnalyzers() {
    // Initialize pose analyzer
    poseAnalyzer = new PoseAnalyzer(elements.videoPreview, elements.poseCanvas);
    await poseAnalyzer.initialize();

    // Initialize face analyzer
    faceAnalyzer = new FaceAnalyzer(elements.videoPreview);
    await faceAnalyzer.initialize();

    // Initialize speech analyzer with apiService for Gemini-powered filler detection
    speechAnalyzer = new SpeechAnalyzer(apiService);
    speechAnalyzer.onResult((result) => {
        // Only append new transcript, not duplicates
        if (result.transcript) {
            state.transcript = result.fullTranscript;
        }
        state.metrics.fillerCount = result.fillerCount;
        state.metrics.fillerWords = result.fillerWords;
        state.metrics.speechRate = result.wpm;
        updateTranscriptDisplay();
    });
    speechAnalyzer.start();

    // Initialize recording service
    recordingService = new RecordingService(state.mediaStream);
}

/**
 * Start analysis loop
 */
function startAnalysisLoop() {
    let lastFeedbackTime = 0;
    const feedbackInterval = 30000; // 30 seconds

    const analyze = async () => {
        if (!state.isPracticing) return;

        // Analyze pose
        if (poseAnalyzer) {
            const poseResults = await poseAnalyzer.analyze();
            state.metrics.postureScore = poseResults.postureScore;
            state.metrics.gestureScore = poseResults.gestureScore;
            state.metrics.postureIssues = poseResults.issues;
        }

        // Analyze face/eye contact
        if (faceAnalyzer) {
            const faceResults = await faceAnalyzer.analyze();
            state.metrics.eyeContactPercent = faceResults.eyeContactPercent;
        }

        // Update UI
        updateMetricsDisplay();

        // Store metrics snapshot
        state.sessionMetrics.push({ ...state.metrics, timestamp: Date.now() });

        // Get AI feedback periodically
        const now = Date.now();
        if (now - lastFeedbackTime > feedbackInterval) {
            lastFeedbackTime = now;
            await getAIFeedback();
        }

        // Continue loop
        if (state.isPracticing) {
            requestAnimationFrame(analyze);
        }
    };

    analyze();
}

/**
 * Update metrics display
 */
function updateMetricsDisplay() {
    // Update ring charts
    updateMetricRing('postureRing', state.metrics.postureScore);
    updateMetricRing('eyeContactRing', state.metrics.eyeContactPercent);
    updateMetricRing('gesturesRing', state.metrics.gestureScore);

    // Update speech rate (show as number, not percent)
    const speechRing = document.querySelector('#speechRing .metric-value');
    if (speechRing) {
        speechRing.textContent = state.metrics.speechRate || '--';
    }

    // Update filler count
    elements.fillerCount.textContent = state.metrics.fillerCount || 0;
}

/**
 * Update a metric ring chart
 */
function updateMetricRing(ringId, value) {
    const ring = document.getElementById(ringId);
    if (!ring) return;

    const fill = ring.querySelector('.ring-fill');
    const valueEl = ring.querySelector('.metric-value');

    if (fill) {
        fill.setAttribute('stroke-dasharray', `${value}, 100`);

        // Color based on value
        fill.classList.remove('good', 'warning', 'danger');
        if (value >= 80) fill.classList.add('good');
        else if (value >= 60) fill.classList.add('warning');
        else fill.classList.add('danger');
    }

    if (valueEl) {
        valueEl.textContent = `${Math.round(value)}%`;
    }
}

/**
 * Update transcript display
 */
function updateTranscriptDisplay() {
    const content = state.transcript || 'Your speech will be transcribed here in real-time...';

    // Highlight filler words
    let displayContent = content;
    const fillers = ['um', 'uh', 'like', 'you know', 'actually', 'basically', 'so', 'right'];
    fillers.forEach(filler => {
        const regex = new RegExp(`\\b${filler}\\b`, 'gi');
        displayContent = displayContent.replace(regex, `<span class="filler-word">${filler}</span>`);
    });

    elements.transcriptContent.innerHTML = `<p>${displayContent}</p>`;
}

/**
 * Get AI feedback
 */
async function getAIFeedback() {
    if (!state.isAuthenticated) return;

    try {
        const response = await apiService.post('/analyze/realtime', {
            metrics: state.metrics,
            transcript: state.transcript.slice(-500),
            slideContent: state.currentPresentation?.slides[state.currentSlideIndex]?.textContent || ''
        });

        const feedback = response.feedback;

        // Update AI feedback display
        elements.aiFeedbackContent.innerHTML = `
            <div class="feedback-tip ${feedback.priority === 'posture' ? 'warning' : ''}">
                <span class="tip-icon">💡</span>
                <p>${feedback.quickTip}</p>
            </div>
        `;

        // Update confidence score
        const scoreBar = elements.confidenceScore.querySelector('.score-fill');
        const scoreValue = elements.confidenceScore.querySelector('.score-value');
        if (scoreBar) scoreBar.style.width = `${feedback.overallScore}%`;
        if (scoreValue) scoreValue.textContent = feedback.overallScore;

    } catch (error) {
        console.error('Failed to get AI feedback:', error);
    }
}

/**
 * Toggle camera
 */
function toggleCamera() {
    if (state.mediaStream) {
        const videoTrack = state.mediaStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            elements.toggleCamera.classList.toggle('active', videoTrack.enabled);
        }
    }
}

/**
 * Toggle microphone
 */
function toggleMic() {
    if (state.mediaStream) {
        const audioTrack = state.mediaStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            elements.toggleMic.classList.toggle('active', audioTrack.enabled);
        }
    }

    if (speechAnalyzer) {
        if (state.mediaStream.getAudioTracks()[0]?.enabled) {
            speechAnalyzer.start();
        } else {
            speechAnalyzer.stop();
        }
    }
}

/**
 * Toggle recording
 */
function toggleRecording() {
    if (!recordingService) return;

    if (state.isRecording) {
        recordingService.stop();
        state.isRecording = false;
        elements.recordingIndicator.classList.remove('active');
        elements.toggleRecording.classList.remove('active');
    } else {
        recordingService.start();
        state.isRecording = true;
        elements.recordingIndicator.classList.add('active');
        elements.toggleRecording.classList.add('active');
        startRecordingTimer();
    }
}

/**
 * Start recording timer
 */
function startRecordingTimer() {
    const startTime = Date.now();

    const updateTimer = () => {
        if (!state.isRecording) return;

        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        elements.recTime.textContent = `${minutes}:${seconds}`;

        requestAnimationFrame(updateTimer);
    };

    updateTimer();
}

/**
 * End practice session
 */
async function endSession() {
    state.isPracticing = false;

    // Stop recording if active
    let recordingBlob = null;
    if (state.isRecording && recordingService) {
        recordingBlob = await recordingService.stop();
        state.isRecording = false;
    }

    // Stop analyzers
    if (speechAnalyzer) speechAnalyzer.stop();

    // Stop media stream
    if (state.mediaStream) {
        state.mediaStream.getTracks().forEach(track => track.stop());
        state.mediaStream = null;
    }

    // Calculate session averages
    const avgMetrics = calculateAverageMetrics();

    // Generate session summary
    if (state.isAuthenticated && state.currentSession) {
        try {
            const summaryResponse = await apiService.post('/analyze/summary', {
                sessionMetrics: avgMetrics,
                transcript: state.transcript
            });

            // Update session in backend
            await apiService.post(`/sessions/${state.currentSession.id}/complete`, {
                metrics: avgMetrics,
                aiSummary: JSON.stringify(summaryResponse.summary),
                overallScore: summaryResponse.summary.overallScore
            });

            // Upload recording to Google Drive if available
            if (recordingBlob && recordingBlob.size > 0) {
                showToast('Uploading recording to Google Drive...', 'info');
                await uploadRecordingToDrive(recordingBlob);
            }

            // Show feedback page
            displaySessionFeedback(summaryResponse.summary, recordingBlob);

        } catch (error) {
            console.error('Failed to generate summary:', error);
            showToast('Failed to generate session summary', 'error');
        }
    }

    navigateTo('feedback');
}

/**
 * Upload recording to Google Drive
 */
async function uploadRecordingToDrive(blob) {
    if (!state.currentSession) return;

    try {
        const formData = new FormData();
        formData.append('recording', blob, 'recording.webm');

        const response = await fetch(`${apiService.baseUrl}/sessions/${state.currentSession.id}/upload-recording`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            showToast('Recording saved to Google Drive!', 'success');
            console.log('Recording uploaded:', result);

            // Store the recording URL
            if (result.recording?.viewUrl) {
                state.currentSession.recordingUrl = result.recording.viewUrl;
            }
        } else {
            throw new Error('Upload failed');
        }
    } catch (error) {
        console.error('Failed to upload recording:', error);
        showToast('Failed to upload recording to Drive', 'error');
    }
}

/**
 * Calculate average metrics from session
 */
function calculateAverageMetrics() {
    if (state.sessionMetrics.length === 0) {
        return state.metrics;
    }

    const avg = (arr, key) => arr.reduce((sum, m) => sum + (m[key] || 0), 0) / arr.length;

    return {
        avgPostureScore: Math.round(avg(state.sessionMetrics, 'postureScore')),
        avgEyeContact: Math.round(avg(state.sessionMetrics, 'eyeContactPercent')),
        avgSpeechRate: Math.round(avg(state.sessionMetrics, 'speechRate')),
        totalFillerWords: state.metrics.fillerCount,
        durationMinutes: Math.round(state.sessionMetrics.length / 60), // Rough estimate
        postureIssues: [...new Set(state.sessionMetrics.flatMap(m => m.postureIssues || []))]
    };
}

/**
 * Display session feedback
 */
function displaySessionFeedback(summary, recordingBlob) {
    // Update score
    const scoreNumber = elements.finalScore.querySelector('.score-number');
    const scoreGrade = elements.finalScore.querySelector('.score-grade');
    if (scoreNumber) scoreNumber.textContent = summary.overallScore || 75;
    if (scoreGrade) scoreGrade.textContent = summary.grade || 'B';

    elements.scoreMessage.textContent = summary.headline || 'Great practice session!';

    // Update strengths
    if (summary.strengths) {
        elements.strengthsList.innerHTML = summary.strengths
            .map(s => `<li>${s.detail || s}</li>`)
            .join('');
    }

    // Update improvements
    if (summary.areasForImprovement) {
        elements.improvementsList.innerHTML = summary.areasForImprovement
            .map(a => `<li>${a.detail || a}</li>`)
            .join('');
    }

    // Update goals
    if (summary.nextSessionGoals) {
        elements.goalsList.innerHTML = summary.nextSessionGoals
            .map(g => `<li>${g}</li>`)
            .join('');
    }

    // Setup recording playback
    if (recordingBlob) {
        const url = URL.createObjectURL(recordingBlob);
        elements.playbackVideo.src = url;
    }
}

/**
 * Save feedback to Google Slides
 */
async function saveToSlides() {
    if (!state.isAuthenticated || !state.currentPresentation) {
        showToast('Please import a presentation first', 'info');
        return;
    }

    try {
        showToast('Saving feedback to slides...', 'info');

        const response = await apiService.post('/analyze/write-to-slides', {
            presentationId: state.currentPresentation.id,
            slideId: state.currentPresentation.slides[0]?.objectId,
            sessionSummary: calculateAverageMetrics(),
            presentationTitle: state.currentPresentation.title
        });

        showToast('Feedback added to speaker notes!', 'success');
    } catch (error) {
        console.error('Failed to save to slides:', error);
        showToast('Failed to save feedback to slides', 'error');
    }
}

/**
 * Load progress data
 */
async function loadProgressData() {
    if (!state.isAuthenticated) return;

    try {
        const [stats, sessionsResponse] = await Promise.all([
            apiService.get('/sessions/stats'),
            apiService.get('/sessions')
        ]);

        // Update overview cards
        document.getElementById('progressSessions').textContent = stats.totalSessions || 0;
        document.getElementById('progressTime').textContent = formatDuration(stats.totalPracticeTime || 0);
        document.getElementById('progressScore').textContent = stats.averageScore || '--';

        // Render session history
        renderSessionHistory(sessionsResponse.sessions || []);

    } catch (error) {
        console.error('Failed to load progress data:', error);
    }
}

/**
 * Render session history
 */
function renderSessionHistory(sessions) {
    const historyList = document.getElementById('sessionHistory');

    if (sessions.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📝</span>
                <p>No sessions recorded yet.</p>
            </div>
        `;
        return;
    }

    historyList.innerHTML = sessions.map(session => `
        <div class="history-item">
            <div class="session-info">
                <span class="session-title">${session.presentationTitle || 'Practice Session'}</span>
                <span class="session-date">${formatDate(session.startedAt)} • ${formatDuration(session.durationSeconds || 0)}</span>
            </div>
            <span class="session-score">${session.overallScore || '--'}</span>
        </div>
    `).join('');
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
        <span class="toast-message">${message}</span>
    `;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Format duration in seconds to human readable
 */
function formatDuration(seconds) {
    if (!seconds) return '0m';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

/**
 * Format date to human readable
 */
function formatDate(dateString) {
    if (!dateString) return '';

    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString();
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
