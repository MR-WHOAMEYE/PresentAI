import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Sidebar from '../components/Layout/Sidebar'
import { useAuth } from '../contexts/AuthContext'
import { useSession } from '../contexts/SessionContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function DashboardPage() {
    const { user, isAuthenticated, loading, hasGoogleDriveAccess, connectGoogleDrive } = useAuth()
    const { sessions, fetchSessions } = useSession()
    const navigate = useNavigate()
    const [presentations, setPresentations] = useState([])
    const [stats, setStats] = useState({ totalSessions: 0, totalPracticeTime: 0, averageScore: 0 })

    useEffect(() => {
        if (isAuthenticated) {
            fetchSessions()
            fetchStats()
            fetchPresentations()
        }
    }, [isAuthenticated])

    async function fetchStats() {
        try {
            const response = await fetch(`${API_URL}/sessions/stats`, { credentials: 'include' })
            if (response.ok) {
                const data = await response.json()
                setStats(data)
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error)
        }
    }

    async function fetchPresentations() {
        try {
            const response = await fetch(`${API_URL}/presentations`, { credentials: 'include' })
            if (response.ok) {
                const data = await response.json()
                setPresentations(data.presentations || [])
            }
        } catch (error) {
            console.error('Failed to fetch presentations:', error)
        }
    }

    function formatTime(seconds) {
        const hours = Math.floor(seconds / 3600)
        const mins = Math.floor((seconds % 3600) / 60)
        if (hours > 0) return `${hours}h ${mins}m`
        return `${mins}m`
    }

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-background-dark">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
            </div>
        )
    }

    return (
        <div className="font-display antialiased text-zinc-100 bg-background-dark min-h-screen flex overflow-hidden">
            <Sidebar />

            <main className="flex-1 overflow-y-auto bg-background-dark">
                {/* Header */}
                <header className="flex h-16 shrink-0 items-center justify-between border-b border-border-dark bg-surface-dark px-6 sticky top-0 z-10">
                    <nav className="hidden md:flex items-center gap-1">
                        <Link to="/practice" className="text-zinc-400 hover:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors">Practice</Link>
                        <Link to="/" className="text-primary px-4 py-2 text-sm font-medium border-b-2 border-primary">My Sessions</Link>
                        <Link to="/progress" className="text-zinc-400 hover:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors">Progress</Link>
                    </nav>
                    <div className="flex items-center gap-4">
                        {isAuthenticated && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-highlight border border-border-dark">
                                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="text-xs font-medium text-zinc-400">Connected</span>
                            </div>
                        )}
                        <button className="relative p-2 text-zinc-400 hover:text-white transition-colors">
                            <span className="material-symbols-outlined">notifications</span>
                        </button>
                    </div>
                </header>

                <div className="p-4 md:p-10 lg:p-12 max-w-6xl mx-auto space-y-6 md:space-y-10 pb-24 lg:pb-12">
                    {/* Welcome Section */}
                    <div className="flex flex-col gap-1 md:gap-2">
                        <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-white">
                            Ready to practice{user?.name ? `, ${user.name.split(' ')[0]}` : ''}?
                        </h1>
                        <p className="text-zinc-400 text-sm md:text-lg">Pick up where you left off or start a new analysis.</p>
                    </div>

                    {/* Action Cards */}
                    <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                        {/* Import Slides Card */}
                        <div className="group relative overflow-hidden rounded-xl md:rounded-2xl bg-surface-dark p-4 md:p-8 border border-border-dark hover:border-blue-500/50 transition-all cursor-pointer shadow-sm hover:shadow-xl hover:shadow-blue-500/10">
                            <div className="absolute top-0 right-0 p-2 md:p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <span className="material-symbols-outlined text-6xl md:text-9xl text-white">present_to_all</span>
                            </div>
                            <div className="relative z-10 flex flex-col h-full items-start">
                                <div className="h-10 w-10 md:h-14 md:w-14 rounded-lg md:rounded-xl bg-orange-900/20 text-[#F4B400] flex items-center justify-center mb-3 md:mb-6">
                                    <span className="material-symbols-outlined text-xl md:text-3xl">slideshow</span>
                                </div>
                                <h3 className="text-base md:text-xl font-bold mb-1 md:mb-2 text-white">Import from Google Slides</h3>
                                <p className="text-zinc-400 text-sm md:text-base mb-4 md:mb-8 line-clamp-2">
                                    {hasGoogleDriveAccess
                                        ? 'Your Google account is connected. Import slides for slide-by-slide feedback.'
                                        : 'Connect your Google account to import slides and get feedback on pacing.'}
                                </p>
                                {hasGoogleDriveAccess ? (
                                    <Link to="/practice" className="mt-auto text-sm font-bold text-primary group-hover:underline flex items-center gap-1">
                                        Import Slides <span className="material-symbols-outlined text-base">arrow_forward</span>
                                    </Link>
                                ) : (
                                    <button
                                        onClick={() => isAuthenticated ? connectGoogleDrive() : navigate('/login')}
                                        className="mt-auto flex items-center gap-2 py-1.5 px-3 bg-[#F4B400] text-gray-900 rounded-lg text-sm font-bold hover:bg-yellow-400 transition-colors"
                                    >
                                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        </svg>
                                        Connect Google
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Quick Practice Card */}
                        <div className="group relative overflow-hidden rounded-xl md:rounded-2xl bg-gradient-to-br from-primary to-blue-700 p-4 md:p-8 text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] cursor-pointer">
                            <div className="absolute bottom-0 right-0 p-2 md:p-4 opacity-20">
                                <span className="material-symbols-outlined text-6xl md:text-9xl">mic</span>
                            </div>
                            <div className="relative z-10 flex flex-col h-full items-start">
                                <div className="h-10 w-10 md:h-14 md:w-14 rounded-lg md:rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-3 md:mb-6">
                                    <span className="material-symbols-outlined text-xl md:text-3xl">videocam</span>
                                </div>
                                <h3 className="text-base md:text-xl font-bold mb-1 md:mb-2">Quick Practice Session</h3>
                                <p className="text-blue-100 text-sm md:text-base mb-4 md:mb-8 line-clamp-2">Start an impromptu speech analysis without visual aids. Great for Q&A practice.</p>
                                <Link to="/practice" className="mt-auto py-1.5 px-3 md:py-2 md:px-4 bg-white text-primary rounded-lg text-sm font-bold hover:bg-gray-100 transition-colors flex items-center gap-2">
                                    Start Now <span className="material-symbols-outlined text-base">play_arrow</span>
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    {isAuthenticated && (
                        <div className="grid grid-cols-3 gap-2 md:gap-4">
                            <div className="bg-surface-dark border border-border-dark rounded-lg md:rounded-xl p-3 md:p-5 flex flex-col md:flex-row items-center gap-2 md:gap-4">
                                <div className="p-2 md:p-3 rounded-lg bg-blue-500/10 text-blue-400">
                                    <span className="material-symbols-outlined text-lg md:text-2xl">timer</span>
                                </div>
                                <div className="text-center md:text-left">
                                    <p className="text-zinc-400 text-[10px] md:text-sm">Practice</p>
                                    <p className="text-white text-sm md:text-xl font-bold">{formatTime(stats.totalPracticeTime)}</p>
                                </div>
                            </div>
                            <div className="bg-surface-dark border border-border-dark rounded-lg md:rounded-xl p-3 md:p-5 flex flex-col md:flex-row items-center gap-2 md:gap-4">
                                <div className="p-2 md:p-3 rounded-lg bg-purple-500/10 text-purple-400">
                                    <span className="material-symbols-outlined text-lg md:text-2xl">mic</span>
                                </div>
                                <div className="text-center md:text-left">
                                    <p className="text-zinc-400 text-[10px] md:text-sm">Sessions</p>
                                    <p className="text-white text-sm md:text-xl font-bold">{stats.totalSessions}</p>
                                </div>
                            </div>
                            <div className="bg-surface-dark border border-border-dark rounded-lg md:rounded-xl p-3 md:p-5 flex flex-col md:flex-row items-center gap-2 md:gap-4">
                                <div className="p-2 md:p-3 rounded-lg bg-green-500/10 text-green-400">
                                    <span className="material-symbols-outlined text-lg md:text-2xl">trending_up</span>
                                </div>
                                <div className="text-center md:text-left">
                                    <p className="text-zinc-400 text-[10px] md:text-sm">Avg Score</p>
                                    <p className="text-white text-sm md:text-xl font-bold">{stats.averageScore || '--'}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Recent Sessions */}
                    {sessions.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-white">Recent Sessions</h2>
                                <Link to="/progress" className="text-sm text-primary hover:underline">View all</Link>
                            </div>
                            <div className="grid gap-3">
                                {sessions.slice(0, 5).map(session => (
                                    <div
                                        key={session.id}
                                        className="bg-surface-dark border border-border-dark rounded-xl p-4 flex items-center justify-between hover:border-border-dark/80 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                                <span className="material-symbols-outlined">videocam</span>
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">{session.presentationTitle || 'Practice Session'}</p>
                                                <p className="text-zinc-500 text-sm">{new Date(session.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {session.overallScore && (
                                                <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-bold">
                                                    {session.overallScore}%
                                                </div>
                                            )}
                                            <span className="material-symbols-outlined text-zinc-500">chevron_right</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
