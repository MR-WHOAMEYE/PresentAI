import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Sidebar, { LogoIcon } from '../components/Layout/Sidebar'
import CircularProgress from '../components/UI/CircularProgress'
import { useSession } from '../contexts/SessionContext'
import { useAuth } from '../contexts/AuthContext'

// Import analyzers
import PoseAnalyzer from '../analyzers/PoseAnalyzer'
import FaceAnalyzer from '../analyzers/FaceAnalyzer'
import SpeechAnalyzer from '../analyzers/SpeechAnalyzer'
import RecordingService from '../services/RecordingService'
import voiceFeedbackService from '../services/VoiceFeedbackService'

export default function PracticePage() {
    const navigate = useNavigate()
    const { isAuthenticated } = useAuth()
    const {
        presentation, setPresentation,
        currentSlideIndex, setCurrentSlideIndex, nextSlide, prevSlide,
        metrics, updateMetrics,
        transcript, setTranscript,
        isRecording, setIsRecording,
        isPracticing, setIsPracticing,
        sessionStartTime, setSessionStartTime,
        createSession, completeSession, currentSession,
        setAiFeedback, setRecordingBlobUrl
    } = useSession()

    const videoRef = useRef(null)
    const poseCanvasRef = useRef(null)
    const streamRef = useRef(null)
    const poseAnalyzerRef = useRef(null)
    const faceAnalyzerRef = useRef(null)
    const speechAnalyzerRef = useRef(null)
    const recordingRef = useRef(null)
    const animationRef = useRef(null)
    const metricsRef = useRef(metrics)

    const [showSlideModal, setShowSlideModal] = useState(false)
    const [slideUrl, setSlideUrl] = useState('')
    const [loading, setLoading] = useState(false)
    const [elapsedTime, setElapsedTime] = useState(0)
    const [userPresentations, setUserPresentations] = useState([])
    const [loadingPresentations, setLoadingPresentations] = useState(false)
    const [showUrlInput, setShowUrlInput] = useState(false)

    // Voice HUD state
    const [voiceTip, setVoiceTip] = useState('')
    const [showVoiceHUD, setShowVoiceHUD] = useState(false)
    const voiceFeedbackIntervalRef = useRef(null)

    useEffect(() => {
        metricsRef.current = metrics
    }, [metrics])

    useEffect(() => {
        let interval
        if (isPracticing && sessionStartTime) {
            interval = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - sessionStartTime) / 1000))
            }, 1000)
        }
        return () => clearInterval(interval)
    }, [isPracticing, sessionStartTime])

    useEffect(() => {
        if (showSlideModal && isAuthenticated) {
            fetchUserPresentations()
        }
    }, [showSlideModal, isAuthenticated])

    async function fetchUserPresentations() {
        setLoadingPresentations(true)
        try {
            const response = await fetch('/presentations', { credentials: 'include' })
            if (response.ok) {
                const data = await response.json()
                setUserPresentations(data.presentations || [])
            }
        } catch (error) {
            console.error('Failed to fetch presentations:', error)
        }
        setLoadingPresentations(false)
    }

    async function selectPresentation(pres) {
        setLoading(true)
        try {
            const response = await fetch(`/presentations/${pres.id}`, { credentials: 'include' })
            if (response.ok) {
                const data = await response.json()
                setPresentation(data)
                setShowSlideModal(false)
            }
        } catch (error) {
            console.error('Failed to load presentation:', error)
        }
        setLoading(false)
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    function formatDate(dateStr) {
        if (!dateStr) return ''
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720 },
                audio: true
            })
            streamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                await new Promise(resolve => { videoRef.current.onloadedmetadata = resolve })
            }
            return stream
        } catch (error) {
            console.error('Failed to access camera:', error)
            alert('Could not access camera. Please ensure permissions are granted.')
            return null
        }
    }

    function stopCamera() {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
        if (videoRef.current) videoRef.current.srcObject = null
    }

    async function initAnalyzers() {
        if (poseCanvasRef.current && videoRef.current) {
            poseCanvasRef.current.width = videoRef.current.videoWidth || 1280
            poseCanvasRef.current.height = videoRef.current.videoHeight || 720
        }

        if (videoRef.current && poseCanvasRef.current) {
            poseAnalyzerRef.current = new PoseAnalyzer(videoRef.current, poseCanvasRef.current)
            await poseAnalyzerRef.current.initialize()
        }

        if (videoRef.current) {
            faceAnalyzerRef.current = new FaceAnalyzer(videoRef.current)
            await faceAnalyzerRef.current.initialize()
        }

        speechAnalyzerRef.current = new SpeechAnalyzer({ baseUrl: '' })
        speechAnalyzerRef.current.onResult((result) => {
            if (result.fullTranscript) setTranscript(result.fullTranscript)
            updateMetrics({
                fillerCount: result.fillerCount,
                fillerWords: result.fillerWords,
                speechRate: result.wpm
            })
        })
        speechAnalyzerRef.current.start()
    }

    function stopAnalyzers() {
        if (speechAnalyzerRef.current) speechAnalyzerRef.current.stop()
        if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }

    function runAnalysisLoop() {
        let isRunning = true
        const analyze = async () => {
            if (!isRunning || !videoRef.current) return

            if (poseAnalyzerRef.current) {
                const poseResult = await poseAnalyzerRef.current.analyze()
                if (poseResult) {
                    updateMetrics({
                        postureScore: poseResult.postureScore || 0,
                        gestureType: poseResult.issues?.length > 0 ? poseResult.issues[0] : 'Good posture'
                    })
                }
            }

            if (faceAnalyzerRef.current) {
                const faceResult = await faceAnalyzerRef.current.analyze()
                if (faceResult) {
                    updateMetrics({ eyeContactPercent: faceResult.eyeContactPercent || 0 })
                }
            }

            animationRef.current = requestAnimationFrame(analyze)
        }
        analyze()
        return () => { isRunning = false }
    }

    async function startPractice() {
        setLoading(true)
        const stream = await startCamera()
        if (!stream) { setLoading(false); return }

        if (isAuthenticated) {
            await createSession(presentation?.id, presentation?.title || 'Practice Session')
        }

        recordingRef.current = new RecordingService(stream)
        recordingRef.current.start()
        await initAnalyzers()

        setIsPracticing(true)
        setIsRecording(true)
        setSessionStartTime(Date.now())
        setLoading(false)
        runAnalysisLoop()

        // Start voice feedback interval (every 20 seconds)
        voiceFeedbackService.loadSettings()
        if (voiceFeedbackService.isEnabled) {
            setShowVoiceHUD(true)
            voiceFeedbackIntervalRef.current = setInterval(async () => {
                const tip = await voiceFeedbackService.getFeedbackAndSpeak(metricsRef.current, transcript)
                if (tip) {
                    setVoiceTip(tip)
                    // Auto-hide after 5 seconds
                    setTimeout(() => setVoiceTip(''), 5000)
                }
            }, 20000)
        }
    }

    async function endPractice() {
        setIsPracticing(false)
        setIsRecording(false)
        stopAnalyzers()

        // Stop voice feedback
        if (voiceFeedbackIntervalRef.current) {
            clearInterval(voiceFeedbackIntervalRef.current)
            voiceFeedbackIntervalRef.current = null
        }
        voiceFeedbackService.stop()
        setShowVoiceHUD(false)

        let recordingBlob = null
        if (recordingRef.current) {
            recordingBlob = await recordingRef.current.stop()
            if (recordingBlob) {
                const blobUrl = URL.createObjectURL(recordingBlob)
                setRecordingBlobUrl(blobUrl)
            }
        }

        const durationSeconds = Math.floor((Date.now() - sessionStartTime) / 1000)
        const overallScore = calculateOverallScore()

        let aiFeedback = null
        try {
            const response = await fetch('/analyze/session-summary', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript, metrics: metricsRef.current, durationSeconds })
            })
            if (response.ok) {
                aiFeedback = await response.json()
                setAiFeedback(aiFeedback)
            }
        } catch (error) {
            console.error('Failed to get AI feedback:', error)
        }

        if (currentSession && isAuthenticated) {
            await completeSession({ overallScore, durationSeconds, transcript, metrics: metricsRef.current, aiFeedback })
            if (recordingBlob) {
                try {
                    const formData = new FormData()
                    formData.append('recording', recordingBlob, 'recording.webm')
                    await fetch(`/sessions/${currentSession.id}/upload-recording`, {
                        method: 'POST', credentials: 'include', body: formData
                    })
                } catch (error) {
                    console.error('Failed to upload recording:', error)
                }
            }
        }

        stopCamera()
        navigate('/feedback')
    }

    function calculateOverallScore() {
        const posture = metricsRef.current.postureScore || 0
        const eyeContact = metricsRef.current.eyeContactPercent || 0
        const pace = metricsRef.current.speechRate
        const paceScore = pace >= 120 && pace <= 150 ? 100 : pace < 100 || pace > 180 ? 50 : 75
        const fillerPenalty = Math.min(metricsRef.current.fillerCount * 2, 30)
        return Math.round((posture * 0.25 + eyeContact * 0.35 + paceScore * 0.25 + (100 - fillerPenalty) * 0.15))
    }

    async function importSlides() {
        if (!slideUrl) return
        setLoading(true)
        try {
            const match = slideUrl.match(/\/presentation\/d\/([a-zA-Z0-9-_]+)/)
            if (!match) { alert('Invalid Google Slides URL'); setLoading(false); return }
            const response = await fetch(`/presentations/${match[1]}`, { credentials: 'include' })
            if (response.ok) {
                setPresentation(await response.json())
                setShowSlideModal(false)
                setSlideUrl('')
                setShowUrlInput(false)
            } else {
                alert('Failed to import slides.')
            }
        } catch (error) {
            console.error('Failed to import slides:', error)
        }
        setLoading(false)
    }

    useEffect(() => {
        return () => { stopAnalyzers(); stopCamera() }
    }, [])

    const overallScore = Math.round((metrics.postureScore + metrics.eyeContactPercent) / 2) || 0
    const overallLabel = overallScore >= 70 ? 'Strong' : overallScore >= 40 ? 'Moderate' : 'Building'

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background-dark font-display text-white">
            <Sidebar collapsed />

            {/* Left Panel - Slide Thumbnails */}
            <aside className="w-28 bg-surface-dark border-r border-border-dark flex flex-col shrink-0">
                <div className="p-3 border-b border-border-dark">
                    <h3 className="text-primary text-sm font-bold">Slide</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {presentation?.slides?.length > 0 ? (
                        presentation.slides.map((slide, i) => (
                            <button
                                key={slide.objectId || i}
                                onClick={() => setCurrentSlideIndex(i)}
                                className={`w-full aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all ${i === currentSlideIndex ? 'border-primary shadow-lg shadow-primary/20' : 'border-border-dark hover:border-zinc-600'
                                    }`}
                            >
                                {slide.thumbnailUrl ? (
                                    <img src={slide.thumbnailUrl} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.querySelector('.slide-fallback')?.classList.remove('hidden'); }} />
                                ) : null}
                                <div className={`slide-fallback w-full h-full bg-primary/80 flex items-center justify-center text-white text-xs font-bold ${slide.thumbnailUrl ? 'hidden' : ''}`}>
                                    {i + 1}
                                </div>
                            </button>
                        ))
                    ) : (
                        <button
                            onClick={() => setShowSlideModal(true)}
                            className="w-full aspect-[4/3] rounded-lg border-2 border-dashed border-border-dark flex items-center justify-center hover:border-primary/50 transition-colors"
                        >
                            <span className="material-symbols-outlined text-zinc-600 text-2xl">add</span>
                        </button>
                    )}
                </div>
            </aside>

            {/* Center Panel - Slideshow + Transcription */}
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header */}
                <header className="flex items-center justify-between border-b border-border-dark px-4 py-2 bg-black/50 backdrop-blur-md shrink-0 z-20">
                    <div className="flex items-center gap-3">
                        <Link to="/" className="flex items-center gap-2 text-white">
                            <div className="size-6 text-white"><LogoIcon /></div>
                            <h2 className="text-sm font-bold">PresentAI</h2>
                        </Link>
                        {isPracticing && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full">
                                <div className="w-2 h-2 bg-red-500 rounded-full recording-pulse"></div>
                                <span className="text-red-400 text-xs font-bold uppercase">Live</span>
                                <span className="text-white font-mono text-xs">{formatTime(elapsedTime)}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {!isPracticing ? (
                            <button
                                onClick={startPractice}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition-colors disabled:opacity-50"
                            >
                                {loading ? (
                                    <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>Starting...</>
                                ) : (
                                    <><span className="material-symbols-outlined text-[18px]">play_arrow</span>Start Session</>
                                )}
                            </button>
                        ) : (
                            <button
                                onClick={endPractice}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[18px]">stop</span>End Session
                            </button>
                        )}
                    </div>
                </header>

                {/* Slideshow Area */}
                <div className="flex-1 flex flex-col gap-3 p-3 overflow-hidden">
                    <div className="flex-1 bg-black rounded-xl overflow-hidden border border-border-dark flex items-center justify-center relative">

                        {/* Voice HUD Overlay */}
                        {showVoiceHUD && voiceTip && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-lg animate-fade-in">
                                <div className="bg-gradient-to-r from-purple-600/90 to-blue-600/90 backdrop-blur-md px-6 py-3 rounded-2xl shadow-xl border border-white/20 flex items-center gap-3">
                                    <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full shrink-0">
                                        <span className="material-symbols-outlined text-white text-lg">record_voice_over</span>
                                    </div>
                                    <p className="text-white text-sm font-medium">{voiceTip}</p>
                                </div>
                            </div>
                        )}

                        {presentation ? (
                            <>
                                {presentation.slides?.[currentSlideIndex]?.thumbnailUrl ? (
                                    <img
                                        src={presentation.slides[currentSlideIndex].thumbnailUrl}
                                        alt={`Slide ${currentSlideIndex + 1}`}
                                        className="max-w-full max-h-full object-contain"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                ) : null}
                                <div className={`text-zinc-500 text-lg ${presentation.slides?.[currentSlideIndex]?.thumbnailUrl ? 'hidden' : ''}`}>Slide {currentSlideIndex + 1}</div>
                                {/* Navigation arrows */}
                                <button
                                    onClick={prevSlide}
                                    disabled={currentSlideIndex === 0}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-full text-white disabled:opacity-20 hover:bg-black/70 transition-colors"
                                >
                                    <span className="material-symbols-outlined">chevron_left</span>
                                </button>
                                <button
                                    onClick={nextSlide}
                                    disabled={currentSlideIndex >= (presentation.slides?.length || 0) - 1}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-full text-white disabled:opacity-20 hover:bg-black/70 transition-colors"
                                >
                                    <span className="material-symbols-outlined">chevron_right</span>
                                </button>
                                {/* Slide counter */}
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/70 rounded-full text-xs text-zinc-400">
                                    {currentSlideIndex + 1} / {presentation.slides?.length || 0}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-4">
                                <span className="text-zinc-600 text-xl">Slide show</span>
                                <button
                                    onClick={() => setShowSlideModal(true)}
                                    className="px-4 py-2 bg-surface-dark border border-border-dark rounded-lg text-sm text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
                                >
                                    Import Google Slides
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Real-time Transcription */}
                    <div className="h-32 bg-surface-dark rounded-xl border border-border-dark p-4 overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-white text-sm font-bold uppercase tracking-wider">
                                Real Time Transcription
                            </h3>
                            {isPracticing && (
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    <span className="text-green-400 text-xs font-medium">Listening</span>
                                </div>
                            )}
                        </div>
                        <div className="h-[calc(100%-28px)] overflow-y-auto" id="transcript-container">
                            <p className={`text-sm leading-relaxed ${transcript ? 'text-white' : 'text-zinc-500'}`}>
                                {transcript || (isPracticing ? 'Listening... Start speaking!' : 'Your speech will appear here in real-time as you speak...')}
                            </p>
                        </div>
                    </div>
                </div>
            </main>

            {/* Right Panel - Metrics + Camera */}
            <aside className="w-72 bg-surface-dark border-l border-border-dark flex flex-col shrink-0">
                <div className="p-4 border-b border-border-dark">
                    <h3 className="text-white font-bold text-sm uppercase tracking-wider">Real-Time Metrics</h3>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Overall Score */}
                    <div className="bg-surface-highlight rounded-xl p-4 border border-border-dark flex items-center gap-4">
                        <CircularProgress value={overallScore} size={56} strokeWidth={3} />
                        <div>
                            <p className="text-zinc-400 text-xs uppercase tracking-wider">Overall</p>
                            <p className="text-white font-bold text-lg">{overallLabel}</p>
                        </div>
                    </div>

                    {/* Eye Contact */}
                    <div className="bg-surface-highlight rounded-xl p-3 border border-border-dark">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-blue-400 text-[20px]">visibility</span>
                                <span className="text-white text-sm font-medium">Eye Contact</span>
                            </div>
                            <span className="text-white font-bold">{Math.round(metrics.eyeContactPercent || 0)}%</span>
                        </div>
                    </div>

                    {/* Posture */}
                    <div className="bg-surface-highlight rounded-xl p-3 border border-border-dark">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-green-400 text-[20px]">accessibility_new</span>
                                <span className="text-white text-sm font-medium">Posture</span>
                            </div>
                            <span className="text-white font-bold">{Math.round(metrics.postureScore || 0)}%</span>
                        </div>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${metrics.postureScore || 0}%` }} />
                        </div>
                    </div>

                    {/* Speech Pace */}
                    <div className="bg-surface-highlight rounded-xl p-3 border border-border-dark">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-purple-400 text-[20px]">graphic_eq</span>
                                <span className="text-white text-sm font-medium">Speech Pace</span>
                            </div>
                            <span className="text-white font-bold">{metrics.speechRate || 0} WPM</span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">Optimal: 120-150 WPM</p>
                    </div>

                    {/* Filler Words */}
                    <div className="bg-surface-highlight rounded-xl p-3 border border-border-dark">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-orange-400 text-[20px]">record_voice_over</span>
                                <span className="text-white text-sm font-medium">Filler Words</span>
                            </div>
                            <span className={`font-bold ${metrics.fillerCount > 10 ? 'text-orange-400' : 'text-white'}`}>
                                {metrics.fillerCount || 0}
                            </span>
                        </div>
                    </div>

                    {/* Posture Notes */}
                    <div className="bg-surface-highlight rounded-xl p-3 border border-border-dark">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-cyan-400 text-[20px]">gesture</span>
                            <span className="text-white text-sm font-medium">Posture Notes</span>
                        </div>
                        <p className="text-white font-bold">{metrics.gestureType || 'Analyzing...'}</p>
                    </div>
                </div>

                {/* Camera Preview */}
                <div className="p-3 border-t border-border-dark">
                    <div className="relative aspect-video bg-sky-400/80 rounded-xl overflow-hidden">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                        />
                        <canvas ref={poseCanvasRef} className="pose-canvas" />
                        {!isPracticing && !streamRef.current && (
                            <div className="absolute inset-0 flex items-center justify-center bg-sky-400/80">
                                <span className="text-white text-sm font-medium">camera</span>
                            </div>
                        )}
                        {isRecording && (
                            <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-red-500/90 rounded text-[10px] text-white font-bold">
                                <div className="w-1.5 h-1.5 bg-white rounded-full recording-pulse"></div>REC
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Slide Import Modal */}
            {showSlideModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-surface-dark rounded-2xl border border-border-dark p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-white text-lg font-bold">Import Google Slides</h3>
                            <button onClick={() => { setShowSlideModal(false); setShowUrlInput(false) }} className="p-2 text-zinc-400 hover:text-white">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {!isAuthenticated ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <span className="material-symbols-outlined text-6xl text-zinc-700 mb-4">login</span>
                                <p className="text-zinc-400 text-center mb-4">Sign in to see your presentations</p>
                                <button onClick={() => window.location.href = 'http://localhost:5000/auth/google'} className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium">
                                    Sign in with Google
                                </button>
                            </div>
                        ) : showUrlInput ? (
                            <div className="space-y-4">
                                <button onClick={() => setShowUrlInput(false)} className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
                                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>Back
                                </button>
                                <input
                                    type="url"
                                    value={slideUrl}
                                    onChange={(e) => setSlideUrl(e.target.value)}
                                    placeholder="https://docs.google.com/presentation/d/..."
                                    className="w-full bg-zinc-900 border border-border-dark rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                                <div className="flex gap-3">
                                    <button onClick={() => setShowUrlInput(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-border-dark text-white">Cancel</button>
                                    <button onClick={importSlides} disabled={!slideUrl || loading} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-white font-medium disabled:opacity-50">
                                        {loading ? 'Importing...' : 'Import'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex-1 overflow-y-auto">
                                    {loadingPresentations ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
                                        </div>
                                    ) : userPresentations.length > 0 ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            {userPresentations.map((pres) => (
                                                <button key={pres.id} onClick={() => selectPresentation(pres)} disabled={loading}
                                                    className="group bg-zinc-900 rounded-xl border border-border-dark overflow-hidden hover:border-primary/50 transition-all text-left disabled:opacity-50">
                                                    <div className="aspect-video bg-zinc-800 relative">
                                                        {pres.thumbnailUrl ? <img src={pres.thumbnailUrl} alt={pres.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" crossOrigin="anonymous" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} /> : null}
                                                        <div className={`w-full h-full flex items-center justify-center ${pres.thumbnailUrl ? 'hidden' : ''}`}><span className="material-symbols-outlined text-4xl text-zinc-600">slideshow</span></div>
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                            <span className="material-symbols-outlined text-white text-3xl">play_circle</span>
                                                        </div>
                                                    </div>
                                                    <div className="p-3">
                                                        <p className="text-white text-sm font-medium truncate">{pres.title}</p>
                                                        <p className="text-zinc-500 text-xs mt-1">{formatDate(pres.lastModified)}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-12">
                                            <span className="material-symbols-outlined text-6xl text-zinc-700 mb-4">folder_open</span>
                                            <p className="text-zinc-400 text-center">No presentations found</p>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4 pt-4 border-t border-border-dark flex items-center justify-between">
                                    <p className="text-zinc-500 text-sm">{userPresentations.length} presentations</p>
                                    <button onClick={() => setShowUrlInput(true)} className="flex items-center gap-2 text-primary hover:text-blue-400 text-sm font-medium">
                                        <span className="material-symbols-outlined text-[18px]">link</span>Import from URL
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
