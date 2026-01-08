import { Link, useNavigate } from 'react-router-dom'
import Sidebar, { LogoIcon } from '../components/Layout/Sidebar'
import { useSession } from '../contexts/SessionContext'
import { useState } from 'react'
import CloudinaryVideoPlayer from '../components/UI/CloudinaryVideoPlayer'

// Tab button component for AI Analysis sections
function TabButton({ active, onClick, icon, label, count }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all active:scale-95 ${active
                ? 'bg-white/10 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
        >
            <span className="material-symbols-outlined text-[16px] sm:text-[18px]">{icon}</span>
            <span className="hidden xs:inline">{label}</span>
            {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-bold ${active ? 'bg-white/20 text-white' : 'bg-zinc-700 text-zinc-300'
                    }`}>
                    {count}
                </span>
            )}
        </button>
    )
}

// Insight card component for expandable items
function InsightCard({ icon, iconColor, bgColor, borderColor, children, type }) {
    return (
        <div className={`flex items-start gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl ${bgColor} border ${borderColor} transition-all active:scale-[0.99]`}>
            <div className={`p-1.5 sm:p-2 rounded-lg ${bgColor} shrink-0`}>
                <span className={`material-symbols-outlined text-[18px] sm:text-[20px] ${iconColor}`}>{icon}</span>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-zinc-300 text-sm leading-relaxed">{children}</p>
            </div>
        </div>
    )
}

export default function FeedbackPage() {
    const navigate = useNavigate()
    const { currentSession, aiFeedback, metrics, recordingBlobUrl } = useSession()
    const [isPlaying, setIsPlaying] = useState(false)
    const [activeTab, setActiveTab] = useState('insights') // 'insights' | 'improvements' | 'strengths' | 'goals'

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
            {/* Sidebar hidden on mobile */}
            <div className="hidden md:block">
                <Sidebar collapsed hideMobileNav />
            </div>

            <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-background-dark">
                {/* Header - Mobile optimized */}
                <header className="flex items-center justify-between whitespace-nowrap border-b border-border-dark px-4 sm:px-8 py-3 bg-surface-dark shrink-0 z-20 safe-area-top">
                    <div className="flex items-center gap-2 sm:gap-4 text-white">
                        <Link to="/" className="flex items-center gap-2">
                            <div className="size-7 sm:size-8 text-white"><LogoIcon /></div>
                            <h2 className="text-white text-base sm:text-lg font-bold leading-tight tracking-[-0.015em] hidden sm:block">PresentAI</h2>
                        </Link>
                    </div>
                    <div className="flex gap-2 sm:gap-4 items-center">
                        <Link to="/practice" className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-white text-black rounded-lg text-xs sm:text-sm font-bold hover:bg-gray-200 active:scale-95 transition-all">
                            <span className="material-symbols-outlined text-[16px] sm:text-[18px]">play_arrow</span>
                            <span className="hidden xs:inline">Practice Again</span>
                            <span className="xs:hidden">Practice</span>
                        </Link>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto bg-background-dark p-4 sm:p-6 lg:p-10 pb-28 sm:pb-24">
                    <div className="max-w-[1200px] mx-auto flex flex-col gap-6 sm:gap-8">
                        {/* Title Section - Mobile optimized */}
                        <div className="flex flex-col gap-4 sm:gap-6 pb-2 border-b border-border-dark/50">
                            {/* Mobile: Score first, then title */}
                            <div className="flex flex-col-reverse sm:flex-row justify-between items-start sm:items-end gap-4 sm:gap-6">
                                <div className="flex flex-col gap-2 max-w-2xl">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="bg-green-500/10 text-green-400 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-green-500/20">
                                            Completed
                                        </span>
                                        <span className="text-text-secondary text-xs sm:text-sm">
                                            {currentSession?.createdAt ? new Date(currentSession.createdAt).toLocaleString() : 'Just now'}
                                        </span>
                                    </div>
                                    <h1 className="text-white text-2xl sm:text-3xl lg:text-4xl font-black leading-tight tracking-[-0.033em]">
                                        Great job!<br />
                                        <span className="text-zinc-500 font-medium text-lg sm:text-2xl lg:text-3xl">Here is your session breakdown.</span>
                                    </h1>
                                </div>

                                {/* Score Circle - Larger on mobile for prominence */}
                                <div className="flex items-center gap-4 sm:gap-6 bg-surface-card p-3 sm:p-4 rounded-xl border border-border-dark w-full sm:w-auto">
                                    <div
                                        className="relative size-16 sm:size-20 flex items-center justify-center rounded-full"
                                        style={{ background: `conic-gradient(#3b82f6 ${score}%, #27272a 0)` }}
                                    >
                                        <div className="absolute inset-[4px] sm:inset-[6px] bg-surface-card rounded-full flex items-center justify-center flex-col">
                                            <span className="text-lg sm:text-xl font-bold text-white">{score}</span>
                                            <span className="text-[8px] sm:text-[10px] text-zinc-500 uppercase font-bold">Score</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-text-secondary text-[16px] sm:text-[18px]">timer</span>
                                            <span className="text-white font-semibold text-sm sm:text-base">{duration}</span>
                                        </div>
                                        <span className="text-zinc-500 text-xs">Duration</span>
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

                                {/* AI Analysis - Enhanced */}
                                <div className="bg-surface-card border border-border-dark rounded-xl overflow-hidden relative">
                                    {/* Header with animated gradient */}
                                    <div className="bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-purple-600/20 p-6 border-b border-border-dark relative overflow-hidden">
                                        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%)] bg-[length:250%_250%] animate-shimmer"></div>
                                        <div className="relative flex items-center justify-between">
                                            <h3 className="text-white font-bold text-xl flex items-center gap-3">
                                                <div className="p-2 bg-purple-500/20 rounded-xl">
                                                    <span className="material-symbols-outlined text-purple-400 text-2xl">psychology</span>
                                                </div>
                                                AI Analysis
                                            </h3>
                                            {aiFeedback?.grade && (
                                                <div className={`relative px-4 py-2 rounded-xl text-lg font-black ${aiFeedback.grade.startsWith('A') ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                                    aiFeedback.grade.startsWith('B') ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                        aiFeedback.grade.startsWith('C') ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                                            'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                                    }`}>
                                                    <span className="text-xs font-medium opacity-70 block -mb-1">Grade</span>
                                                    {aiFeedback.grade}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-6">
                                        {/* Summary Card */}
                                        <div className="bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 p-5 rounded-xl border border-zinc-700/50 mb-6 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl"></div>
                                            <div className="relative">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className="material-symbols-outlined text-purple-400 text-[18px]">summarize</span>
                                                    <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Summary</span>
                                                </div>
                                                <p className="text-zinc-200 leading-relaxed">
                                                    {aiFeedback?.summary || "Complete a practice session to receive personalized AI feedback on your presentation skills."}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Tab Navigation */}
                                        <div className="flex flex-wrap gap-2 mb-6 p-1 bg-zinc-900/50 rounded-xl">
                                            <TabButton
                                                active={activeTab === 'insights'}
                                                onClick={() => setActiveTab('insights')}
                                                icon="insights"
                                                label="Insights"
                                                count={aiFeedback?.naturalInsights?.length || 0}
                                            />
                                            <TabButton
                                                active={activeTab === 'strengths'}
                                                onClick={() => setActiveTab('strengths')}
                                                icon="thumb_up"
                                                label="Strengths"
                                                count={aiFeedback?.positives?.length || 0}
                                            />
                                            <TabButton
                                                active={activeTab === 'improvements'}
                                                onClick={() => setActiveTab('improvements')}
                                                icon="trending_up"
                                                label="Improve"
                                                count={aiFeedback?.improvements?.length || 0}
                                            />
                                            <TabButton
                                                active={activeTab === 'goals'}
                                                onClick={() => setActiveTab('goals')}
                                                icon="flag"
                                                label="Goals"
                                                count={aiFeedback?.nextSessionGoals?.length || 0}
                                            />
                                        </div>

                                        {/* Tab Content */}
                                        <div className="space-y-3 min-h-[200px]">
                                            {/* Insights Tab */}
                                            {activeTab === 'insights' && (
                                                <>
                                                    {aiFeedback?.naturalInsights?.length > 0 ? (
                                                        aiFeedback.naturalInsights.map((item, i) => (
                                                            <InsightCard
                                                                key={i}
                                                                icon="auto_awesome"
                                                                iconColor="text-blue-400"
                                                                bgColor="bg-blue-500/5"
                                                                borderColor="border-blue-500/20"
                                                            >
                                                                {item}
                                                            </InsightCard>
                                                        ))
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                                                            <span className="material-symbols-outlined text-4xl mb-2">lightbulb</span>
                                                            <p>Key insights will appear here</p>
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {/* Strengths Tab */}
                                            {activeTab === 'strengths' && (
                                                <>
                                                    {aiFeedback?.positives?.length > 0 ? (
                                                        aiFeedback.positives.map((item, i) => (
                                                            <InsightCard
                                                                key={i}
                                                                icon="check_circle"
                                                                iconColor="text-green-400"
                                                                bgColor="bg-green-500/5"
                                                                borderColor="border-green-500/20"
                                                            >
                                                                {item}
                                                            </InsightCard>
                                                        ))
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                                                            <span className="material-symbols-outlined text-4xl mb-2">workspace_premium</span>
                                                            <p>Your strengths will be highlighted here</p>
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {/* Improvements Tab */}
                                            {activeTab === 'improvements' && (
                                                <>
                                                    {aiFeedback?.improvements?.length > 0 ? (
                                                        aiFeedback.improvements.map((item, i) => (
                                                            <InsightCard
                                                                key={i}
                                                                icon="arrow_upward"
                                                                iconColor="text-yellow-400"
                                                                bgColor="bg-yellow-500/5"
                                                                borderColor="border-yellow-500/20"
                                                            >
                                                                {item}
                                                            </InsightCard>
                                                        ))
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                                                            <span className="material-symbols-outlined text-4xl mb-2">school</span>
                                                            <p>Improvement suggestions will appear here</p>
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {/* Goals Tab */}
                                            {activeTab === 'goals' && (
                                                <>
                                                    {aiFeedback?.nextSessionGoals?.length > 0 ? (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                            {aiFeedback.nextSessionGoals.map((goal, i) => (
                                                                <div
                                                                    key={i}
                                                                    className="flex items-center gap-3 p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl hover:bg-cyan-500/10 transition-colors"
                                                                >
                                                                    <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-sm">
                                                                        {i + 1}
                                                                    </div>
                                                                    <span className="text-cyan-300 text-sm font-medium">{goal}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                                                            <span className="material-symbols-outlined text-4xl mb-2">target</span>
                                                            <p>Goals for your next session will appear here</p>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        {/* Motivational Message */}
                                        {aiFeedback?.motivationalMessage && (
                                            <div className="mt-6 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-blue-500/10 p-5 rounded-xl border border-purple-500/20 relative overflow-hidden">
                                                <div className="absolute -top-4 -right-4 text-6xl opacity-10">✨</div>
                                                <div className="flex items-start gap-3 relative">
                                                    <span className="material-symbols-outlined text-purple-400 text-2xl">favorite</span>
                                                    <p className="text-white text-sm italic leading-relaxed">
                                                        "{aiFeedback.motivationalMessage}"
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>


                            {/* Right Column - Metrics */}
                            <div className="lg:col-span-4 flex flex-col gap-4">
                                {/* Engagement Breakdown - NEW */}
                                <div className="bg-surface-card border border-border-dark rounded-xl p-5">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-2 bg-purple-500/10 rounded-lg">
                                            <span className="material-symbols-outlined text-purple-400">psychology_alt</span>
                                        </div>
                                        <div>
                                            <p className="text-white font-semibold">Engagement Breakdown</p>
                                            <p className="text-xs text-zinc-500">Audience connection metrics</p>
                                        </div>
                                    </div>

                                    {/* Engagement Score Ring */}
                                    <div className="flex items-center gap-4 mb-4 p-3 bg-zinc-900/50 rounded-xl">
                                        <div
                                            className="relative size-16 flex items-center justify-center rounded-full shrink-0"
                                            style={{
                                                background: `conic-gradient(${(metrics?.eyeContactPercent || 0) >= 70 ? '#22c55e' :
                                                    (metrics?.eyeContactPercent || 0) >= 40 ? '#eab308' : '#ef4444'
                                                    } ${metrics?.eyeContactPercent || 0}%, #27272a 0)`
                                            }}
                                        >
                                            <div className="absolute inset-[4px] bg-zinc-900 rounded-full flex items-center justify-center">
                                                <span className="text-lg font-bold text-white">{metrics?.eyeContactPercent || 0}%</span>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-white font-medium">Audience Focus</p>
                                            <p className={`text-sm ${(metrics?.eyeContactPercent || 0) >= 70 ? 'text-green-400' :
                                                (metrics?.eyeContactPercent || 0) >= 40 ? 'text-yellow-400' : 'text-red-400'
                                                }`}>
                                                {(metrics?.eyeContactPercent || 0) >= 70 ? 'Excellent engagement' :
                                                    (metrics?.eyeContactPercent || 0) >= 40 ? 'Good connection' : 'Needs improvement'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Head Pose Stats (if available) */}
                                    {metrics?.headPose && (
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div className="bg-zinc-900/50 rounded-lg p-2">
                                                <p className="text-zinc-500 text-[10px] uppercase">Yaw</p>
                                                <p className="text-white font-mono text-sm font-bold">{metrics.headPose?.yaw || 0}°</p>
                                            </div>
                                            <div className="bg-zinc-900/50 rounded-lg p-2">
                                                <p className="text-zinc-500 text-[10px] uppercase">Pitch</p>
                                                <p className="text-white font-mono text-sm font-bold">{metrics.headPose?.pitch || 0}°</p>
                                            </div>
                                            <div className="bg-zinc-900/50 rounded-lg p-2">
                                                <p className="text-zinc-500 text-[10px] uppercase">Roll</p>
                                                <p className="text-white font-mono text-sm font-bold">{metrics.headPose?.roll || 0}°</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Speech Pace - Enhanced */}
                                <div className="bg-surface-card border border-border-dark rounded-xl p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-text-secondary text-xs font-medium uppercase tracking-wider">Speech Pace</p>
                                            <h4 className={`text-2xl font-bold mt-1 ${(metrics?.speechRate || 0) >= 120 && (metrics?.speechRate || 0) <= 150 ? 'text-green-400' :
                                                (metrics?.speechRate || 0) < 100 || (metrics?.speechRate || 0) > 180 ? 'text-red-400' : 'text-yellow-400'
                                                }`}>
                                                {metrics?.speechRate || 0} <span className="text-sm font-normal text-text-secondary">WPM</span>
                                            </h4>
                                        </div>
                                        <div className={`p-2 rounded-lg border ${(metrics?.speechRate || 0) >= 120 && (metrics?.speechRate || 0) <= 150
                                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                            : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                            }`}>
                                            <span className="material-symbols-outlined">graphic_eq</span>
                                        </div>
                                    </div>
                                    {/* Speed indicator bar */}
                                    <div className="relative h-2 bg-zinc-800 rounded-full overflow-hidden">
                                        <div className="absolute inset-0 flex">
                                            <div className="w-[33%] bg-red-500/30"></div>
                                            <div className="w-[34%] bg-green-500/30"></div>
                                            <div className="w-[33%] bg-red-500/30"></div>
                                        </div>
                                        <div
                                            className="absolute top-0 h-full w-2 bg-white rounded-full shadow-lg transition-all"
                                            style={{ left: `calc(${Math.min(100, Math.max(0, ((metrics?.speechRate || 0) / 200) * 100))}% - 4px)` }}
                                        ></div>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                                        <span>Slow</span>
                                        <span className="text-green-400">120-150</span>
                                        <span>Fast</span>
                                    </div>
                                </div>

                                {/* Filler Words - Enhanced */}
                                <div className="bg-surface-card border border-border-dark rounded-xl p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-text-secondary text-xs font-medium uppercase tracking-wider">Filler Words</p>
                                            <h4 className={`text-2xl font-bold mt-1 ${(metrics?.fillerCount || 0) <= 3 ? 'text-green-400' :
                                                (metrics?.fillerCount || 0) <= 10 ? 'text-yellow-400' : 'text-red-400'
                                                }`}>{metrics?.fillerCount || 0}</h4>
                                        </div>
                                        <div className={`p-2 rounded-lg border ${(metrics?.fillerCount || 0) <= 3
                                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                            : (metrics?.fillerCount || 0) <= 10
                                                ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                                : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                            }`}>
                                            <span className="material-symbols-outlined">record_voice_over</span>
                                        </div>
                                    </div>
                                    {metrics?.fillerWords?.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {[...new Set(metrics.fillerWords)].slice(0, 8).map((word, i) => (
                                                <span key={i} className="px-2.5 py-1 bg-zinc-800 rounded-lg text-xs text-zinc-400 border border-zinc-700">
                                                    "{word}"
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {(metrics?.fillerCount || 0) === 0 && (
                                        <p className="text-green-400 text-sm flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[16px]">check</span>
                                            Great job! No filler words detected.
                                        </p>
                                    )}
                                </div>

                                {/* Posture - Enhanced */}
                                <div className="bg-surface-card border border-border-dark rounded-xl p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-text-secondary text-xs font-medium uppercase tracking-wider">Posture Score</p>
                                            <h4 className={`text-2xl font-bold mt-1 ${(metrics?.postureScore || 0) >= 80 ? 'text-green-400' :
                                                (metrics?.postureScore || 0) >= 50 ? 'text-yellow-400' : 'text-red-400'
                                                }`}>{metrics?.postureScore || 0}%</h4>
                                        </div>
                                        <div className={`p-2 rounded-lg border ${(metrics?.postureScore || 0) >= 80
                                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                            : 'bg-green-500/10 text-green-400 border-green-500/20'
                                            }`}>
                                            <span className="material-symbols-outlined">accessibility_new</span>
                                        </div>
                                    </div>
                                    <div className="h-2.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-500 ${(metrics?.postureScore || 0) >= 80 ? 'bg-green-500' :
                                                (metrics?.postureScore || 0) >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                                }`}
                                            style={{ width: `${metrics?.postureScore || 0}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-2">
                                        {(metrics?.postureScore || 0) >= 80 ? 'Excellent posture throughout!' :
                                            (metrics?.postureScore || 0) >= 50 ? 'Good posture, minor adjustments needed' :
                                                'Focus on maintaining upright posture'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar - Mobile optimized */}
                <div className="absolute bottom-0 w-full bg-surface-dark/95 backdrop-blur-md border-t border-border-dark px-4 sm:px-8 py-3 sm:py-4 z-30 safe-area-bottom">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
                        <p className="text-text-secondary text-xs sm:text-sm hidden sm:block">Session complete</p>
                        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                            <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-transparent border border-border-dark text-white hover:bg-white/5 active:scale-95 rounded-lg text-xs sm:text-sm font-medium transition-all">
                                <span className="material-symbols-outlined text-[16px] sm:text-[18px]">share</span>
                                Share
                            </button>
                            <button
                                onClick={() => navigate('/')}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 bg-white text-black hover:bg-gray-200 active:scale-95 rounded-lg text-xs sm:text-sm font-bold transition-all"
                            >
                                <span className="material-symbols-outlined text-[16px] sm:text-[18px]">save</span>
                                <span className="hidden xs:inline">Save to Dashboard</span>
                                <span className="xs:hidden">Save</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Bottom Navigation */}
                <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-dark/95 backdrop-blur-md border-t border-border-dark flex items-center justify-around px-4 z-40 safe-area-bottom">
                    <Link to="/" className="flex flex-col items-center gap-1 text-zinc-400 active:text-white">
                        <span className="material-symbols-outlined text-[22px]">home</span>
                        <span className="text-[10px]">Home</span>
                    </Link>
                    <Link to="/practice" className="flex flex-col items-center gap-1 text-zinc-400 active:text-white">
                        <span className="material-symbols-outlined text-[22px]">play_circle</span>
                        <span className="text-[10px]">Practice</span>
                    </Link>
                    <div className="flex flex-col items-center gap-1 text-primary">
                        <span className="material-symbols-outlined text-[22px]">analytics</span>
                        <span className="text-[10px] font-medium">Results</span>
                    </div>
                    <button
                        onClick={() => navigate('/')}
                        className="flex flex-col items-center gap-1 text-zinc-400 active:text-white"
                    >
                        <span className="material-symbols-outlined text-[22px]">save</span>
                        <span className="text-[10px]">Save</span>
                    </button>
                </nav>
            </main>
        </div>
    )
}
