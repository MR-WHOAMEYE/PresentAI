import { Link } from 'react-router-dom'
import Sidebar from '../components/Layout/Sidebar'
import { useSession } from '../contexts/SessionContext'
import { useEffect } from 'react'

export default function ProgressPage() {
    const { sessions, fetchSessions } = useSession()

    useEffect(() => {
        fetchSessions()
    }, [])

    // Calculate stats
    const totalSessions = sessions.length
    const completedSessions = sessions.filter(s => s.overallScore)
    const avgScore = completedSessions.length > 0
        ? Math.round(completedSessions.reduce((sum, s) => sum + (s.overallScore || 0), 0) / completedSessions.length)
        : 0
    const totalTime = sessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0)
    const totalHours = (totalTime / 3600).toFixed(1)

    return (
        <div className="bg-background-dark font-display text-white overflow-hidden h-screen flex">
            <Sidebar />

            <main className="flex-1 overflow-y-auto relative bg-background-dark">
                {/* Header */}
                <header className="flex items-center justify-between border-b border-border-dark bg-surface-dark px-6 lg:px-10 py-3 sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <h2 className="text-white text-lg font-bold">Progress</h2>
                    </div>
                    <div className="flex gap-4">
                        <button className="flex h-10 items-center justify-center gap-2 rounded-lg bg-surface-dark px-4 text-white hover:bg-border-dark transition-colors border border-border-dark">
                            <span className="material-symbols-outlined text-[20px]">notifications</span>
                        </button>
                    </div>
                </header>

                <div className="max-w-[1200px] mx-auto p-4 md:p-8 space-y-8">
                    {/* Title */}
                    <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
                        <div className="flex flex-col gap-2">
                            <h1 className="text-white text-3xl md:text-4xl font-black leading-tight tracking-tight">Your Progress</h1>
                            <p className="text-text-secondary text-base font-normal">Tracking your growth over time</p>
                        </div>
                        <div className="flex items-center gap-4 bg-surface-dark p-1.5 rounded-xl border border-border-dark">
                            <div className="flex bg-background-dark rounded-lg p-1 border border-border-dark">
                                <button className="px-4 py-1.5 rounded text-sm font-medium text-text-secondary hover:text-white transition-colors">Week</button>
                                <button className="px-4 py-1.5 rounded bg-surface-dark text-white text-sm font-bold shadow-sm border border-border-dark">Month</button>
                                <button className="px-4 py-1.5 rounded text-text-secondary hover:text-white transition-colors text-sm font-medium">All Time</button>
                            </div>
                        </div>
                    </div>

                    {/* Stat Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div className="bg-surface-dark border border-border-dark rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-text-secondary/30 transition-colors">
                            <div className="flex justify-between items-start">
                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                    <span className="material-symbols-outlined">mic</span>
                                </div>
                                <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                                    <span className="material-symbols-outlined text-[14px]">trending_up</span>
                                </span>
                            </div>
                            <div>
                                <p className="text-text-secondary text-sm font-medium">Total Sessions</p>
                                <h3 className="text-white text-2xl font-bold mt-1">{totalSessions}</h3>
                            </div>
                        </div>

                        <div className="bg-surface-dark border border-border-dark rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-text-secondary/30 transition-colors">
                            <div className="flex justify-between items-start">
                                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                                    <span className="material-symbols-outlined">timer</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-text-secondary text-sm font-medium">Practice Time</p>
                                <h3 className="text-white text-2xl font-bold mt-1">{totalHours}h</h3>
                            </div>
                        </div>

                        <div className="bg-surface-dark border border-border-dark rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-text-secondary/30 transition-colors">
                            <div className="flex justify-between items-start">
                                <div className="p-2 rounded-lg bg-green-500/10 text-green-400">
                                    <span className="material-symbols-outlined">emoji_events</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-text-secondary text-sm font-medium">Avg Score</p>
                                <h3 className="text-white text-2xl font-bold mt-1">{avgScore || '--'}</h3>
                            </div>
                        </div>

                        <div className="bg-surface-dark border border-border-dark rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-text-secondary/30 transition-colors">
                            <div className="flex justify-between items-start">
                                <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400">
                                    <span className="material-symbols-outlined">local_fire_department</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-text-secondary text-sm font-medium">Completed Sessions</p>
                                <h3 className="text-white text-2xl font-bold mt-1">{completedSessions.length}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-surface-dark border border-border-dark rounded-xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-white text-lg font-bold">Score Trend</h3>
                                    <p className="text-text-secondary text-sm">Overall performance over time</p>
                                </div>
                            </div>
                            <div className="relative w-full h-[300px] flex items-end gap-2 pt-10">
                                <svg className="w-full h-full absolute inset-0 z-10" preserveAspectRatio="none" viewBox="0 0 100 100">
                                    <defs>
                                        <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    <path d="M0,80 C10,75 20,60 30,65 C40,70 50,40 60,35 C70,30 80,45 90,20 L100,15 L100,100 L0,100 Z" fill="url(#chartGradient)" />
                                    <path d="M0,80 C10,75 20,60 30,65 C40,70 50,40 60,35 C70,30 80,45 90,20 L100,15" fill="none" stroke="#3b82f6" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                    <circle cx="30" cy="65" fill="#3b82f6" r="3" stroke="#18181b" strokeWidth="2" />
                                    <circle cx="60" cy="35" fill="#3b82f6" r="3" stroke="#18181b" strokeWidth="2" />
                                    <circle cx="90" cy="20" fill="#3b82f6" r="3" stroke="#18181b" strokeWidth="2" />
                                </svg>
                            </div>
                        </div>

                        {/* Skill Balance */}
                        <div className="bg-surface-dark border border-border-dark rounded-xl p-6 flex flex-col">
                            <div className="mb-4">
                                <h3 className="text-white text-lg font-bold">Skill Balance</h3>
                                <p className="text-text-secondary text-sm">Your strengths & areas to improve</p>
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                                <svg className="w-full max-w-[200px]" viewBox="0 0 200 200">
                                    <g fill="none" opacity="0.3" stroke="#333333" strokeWidth="1">
                                        <polygon points="100,20 170,60 170,140 100,180 30,140 30,60" />
                                        <polygon points="100,40 152.5,70 152.5,130 100,160 47.5,130 47.5,70" />
                                        <polygon points="100,60 135,80 135,120 100,140 65,120 65,80" />
                                    </g>
                                    <polygon fill="rgba(59, 130, 246, 0.2)" points="100,30 160,70 150,135 100,165 50,120 40,70" stroke="#3b82f6" strokeWidth="2" />
                                </svg>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs">
                                <div><span className="text-zinc-400">Eye Contact</span></div>
                                <div><span className="text-zinc-400">Pace</span></div>
                                <div><span className="text-zinc-400">Clarity</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Session History */}
                    <div className="bg-surface-dark border border-border-dark rounded-xl p-6">
                        <h3 className="text-white text-lg font-bold mb-4">Session History</h3>
                        {sessions.length === 0 ? (
                            <div className="text-center py-12">
                                <span className="material-symbols-outlined text-6xl text-zinc-700 mb-4">history</span>
                                <p className="text-zinc-500">No sessions yet. Start practicing!</p>
                                <Link to="/practice" className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
                                    <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                                    Start Practice
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {sessions.map(session => (
                                    <div
                                        key={session.id}
                                        className="flex items-center justify-between p-4 rounded-lg bg-background-dark border border-border-dark hover:border-zinc-700 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                                <span className="material-symbols-outlined">videocam</span>
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">{session.presentationTitle || 'Practice Session'}</p>
                                                <p className="text-zinc-500 text-sm">
                                                    {new Date(session.createdAt).toLocaleDateString()} •
                                                    {session.durationSeconds ? ` ${Math.round(session.durationSeconds / 60)}m` : ''}
                                                </p>
                                            </div>
                                        </div>
                                        {session.overallScore && (
                                            <div className="text-right">
                                                <span className="text-2xl font-bold text-white">{session.overallScore}</span>
                                                <span className="text-zinc-500 text-sm">/100</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}
