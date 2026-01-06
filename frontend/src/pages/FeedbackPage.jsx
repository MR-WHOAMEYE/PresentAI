import { Link, useNavigate } from 'react-router-dom'
import Sidebar, { LogoIcon } from '../components/Layout/Sidebar'
import { useSession } from '../contexts/SessionContext'
import { useState } from 'react'
import CloudinaryVideoPlayer from '../components/UI/CloudinaryVideoPlayer'

export default function FeedbackPage() {
    const navigate = useNavigate()
    const { currentSession, aiFeedback, metrics, recordingBlobUrl } = useSession()
    const [isPlaying, setIsPlaying] = useState(false)

    const score = aiFeedback?.overallScore || currentSession?.overallScore || 0
    const duration = currentSession?.durationSeconds
        ? `${Math.floor(currentSession.durationSeconds / 60)}m ${currentSession.durationSeconds % 60}s`
        : '0m 0s'

    // Support both local blob URL and Cloudinary URL
    const videoUrl = recordingBlobUrl || currentSession?.recording_url || currentSession?.recordingUrl
    const playerUrl = currentSession?.recording_player_url || currentSession?.recordingPlayerUrl
    const thumbnailUrl = currentSession?.recording_thumbnail || currentSession?.recordingThumbnail

    return (
        <div className="bg-background-dark text-white font-display overflow-hidden h-screen flex">
            <Sidebar collapsed />

            <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-background-dark">
                {/* Header */}
                <header className="flex items-center justify-between whitespace-nowrap border-b border-border-dark px-8 py-3 bg-surface-dark shrink-0 z-20">
                    <div className="flex items-center gap-4 text-white">
                        <div className="size-8 text-white"><LogoIcon /></div>
                        <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">PresentAI</h2>
                    </div>
                    <div className="flex gap-4 items-center">
                        <Link to="/practice" className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors">
                            <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                            Practice Again
                        </Link>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto bg-background-dark p-6 lg:p-10 pb-24">
                    <div className="max-w-[1200px] mx-auto flex flex-col gap-8">
                        {/* Title Section */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-2 border-b border-border-dark/50">
                            <div className="flex flex-col gap-2 max-w-2xl">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="bg-green-500/10 text-green-400 text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-green-500/20">
                                        Completed
                                    </span>
                                    <span className="text-text-secondary text-sm">
                                        {currentSession?.createdAt ? new Date(currentSession.createdAt).toLocaleString() : 'Just now'}
                                    </span>
                                </div>
                                <h1 className="text-white text-3xl lg:text-4xl font-black leading-tight tracking-[-0.033em]">
                                    Great job!<br />
                                    <span className="text-zinc-500 font-medium">Here is your session breakdown.</span>
                                </h1>
                            </div>

                            {/* Score Circle */}
                            <div className="flex items-center gap-6 bg-surface-card p-4 rounded-xl border border-border-dark">
                                <div
                                    className="relative size-20 flex items-center justify-center rounded-full"
                                    style={{ background: `conic-gradient(#3b82f6 ${score}%, #27272a 0)` }}
                                >
                                    <div className="absolute inset-[6px] bg-surface-card rounded-full flex items-center justify-center flex-col">
                                        <span className="text-xl font-bold text-white">{score}</span>
                                        <span className="text-[10px] text-zinc-500 uppercase font-bold">Score</span>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 pr-4">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-text-secondary text-[18px]">timer</span>
                                        <span className="text-white font-semibold">{duration}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main Content Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Left Column - Video & AI Analysis */}
                            <div className="lg:col-span-8 flex flex-col gap-6">
                                {/* Video Player - Cloudinary or Fallback */}
                                <div className="bg-surface-card border border-border-dark rounded-xl overflow-hidden flex flex-col shadow-xl shadow-black/40">
                                    {playerUrl ? (
                                        // Use Cloudinary embedded player
                                        <CloudinaryVideoPlayer
                                            playerUrl={playerUrl}
                                            className="aspect-video"
                                        />
                                    ) : videoUrl ? (
                                        // Fallback to native video or Cloudinary URL
                                        <CloudinaryVideoPlayer
                                            url={videoUrl}
                                            poster={thumbnailUrl}
                                            controls={true}
                                            className="aspect-video"
                                            onPlay={() => setIsPlaying(true)}
                                            onPause={() => setIsPlaying(false)}
                                        />
                                    ) : (
                                        <div className="aspect-video bg-black flex flex-col items-center justify-center text-zinc-500">
                                            <span className="material-symbols-outlined text-6xl mb-4">videocam_off</span>
                                            <p className="text-lg">No recording available</p>
                                            <p className="text-sm text-zinc-600 mt-2">Recording will appear here after your session</p>
                                        </div>
                                    )}
                                </div>

                                {/* AI Analysis */}
                                <div className="bg-surface-card border border-border-dark rounded-xl p-6 relative overflow-hidden">
                                    <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-purple-400">psychology</span>
                                        AI Analysis
                                    </h3>
                                    <div className="bg-zinc-900/50 p-4 rounded-lg border border-border-dark mb-6">
                                        <p className="text-zinc-300 leading-relaxed text-sm">
                                            {aiFeedback?.summary || "AI analysis will appear here after your session."}
                                        </p>
                                    </div>

                                    {/* Improvements */}
                                    {aiFeedback?.improvements && (
                                        <div className="space-y-3">
                                            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Areas to Improve</h4>
                                            <ul className="space-y-2">
                                                {aiFeedback.improvements.map((item, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                                                        <span className="material-symbols-outlined text-yellow-500 text-[18px] mt-0.5">arrow_forward</span>
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Positives */}
                                    {aiFeedback?.positives && (
                                        <div className="space-y-3 mt-6">
                                            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Strengths</h4>
                                            <ul className="space-y-2">
                                                {aiFeedback.positives.map((item, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                                                        <span className="material-symbols-outlined text-green-500 text-[18px] mt-0.5">check_circle</span>
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Column - Metrics */}
                            <div className="lg:col-span-4 flex flex-col gap-6">
                                {/* Eye Contact */}
                                <div className="bg-surface-card border border-border-dark rounded-xl p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-text-secondary text-xs font-medium uppercase tracking-wider">Eye Contact</p>
                                            <h4 className="text-white text-2xl font-bold mt-1">{metrics?.eyeContactPercent || 0}%</h4>
                                        </div>
                                        <div className="bg-blue-500/10 p-2 rounded-lg text-blue-400 border border-blue-500/20">
                                            <span className="material-symbols-outlined">visibility</span>
                                        </div>
                                    </div>
                                    <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500"
                                            style={{ width: `${metrics?.eyeContactPercent || 0}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Speech Pace */}
                                <div className="bg-surface-card border border-border-dark rounded-xl p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-text-secondary text-xs font-medium uppercase tracking-wider">Speech Pace</p>
                                            <h4 className="text-white text-2xl font-bold mt-1">
                                                {metrics?.speechRate || 0} <span className="text-sm font-normal text-text-secondary">WPM</span>
                                            </h4>
                                        </div>
                                        <div className="bg-purple-500/10 p-2 rounded-lg text-purple-400 border border-purple-500/20">
                                            <span className="material-symbols-outlined">graphic_eq</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-zinc-500">Optimal: 120-150 WPM</p>
                                </div>

                                {/* Filler Words */}
                                <div className="bg-surface-card border border-border-dark rounded-xl p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-text-secondary text-xs font-medium uppercase tracking-wider">Filler Words</p>
                                            <h4 className="text-white text-2xl font-bold mt-1">{metrics?.fillerCount || 0}</h4>
                                        </div>
                                        <div className="bg-orange-500/10 p-2 rounded-lg text-orange-400 border border-orange-500/20">
                                            <span className="material-symbols-outlined">record_voice_over</span>
                                        </div>
                                    </div>
                                    {metrics?.fillerWords?.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {[...new Set(metrics.fillerWords)].slice(0, 5).map((word, i) => (
                                                <span key={i} className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400">
                                                    {word}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Posture */}
                                <div className="bg-surface-card border border-border-dark rounded-xl p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-text-secondary text-xs font-medium uppercase tracking-wider">Posture Score</p>
                                            <h4 className="text-white text-2xl font-bold mt-1">{metrics?.postureScore || 0}%</h4>
                                        </div>
                                        <div className="bg-green-500/10 p-2 rounded-lg text-green-400 border border-green-500/20">
                                            <span className="material-symbols-outlined">accessibility_new</span>
                                        </div>
                                    </div>
                                    <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-green-500"
                                            style={{ width: `${metrics?.postureScore || 0}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="absolute bottom-0 w-full bg-surface-dark/95 backdrop-blur-md border-t border-border-dark px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 z-30">
                    <p className="text-text-secondary text-sm hidden sm:block">Session complete</p>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent border border-border-dark text-white hover:bg-white/5 rounded-lg text-sm font-medium transition-colors">
                            <span className="material-symbols-outlined text-[18px]">share</span>
                            Share
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-white text-black hover:bg-gray-200 rounded-lg text-sm font-bold transition-colors"
                        >
                            <span className="material-symbols-outlined text-[18px]">save</span>
                            Save to Dashboard
                        </button>
                    </div>
                </div>
            </main>
        </div>
    )
}
