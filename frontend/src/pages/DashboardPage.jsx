import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Sidebar from '../components/Layout/Sidebar'
import { useAuth } from '../contexts/AuthContext'
import { useSession } from '../contexts/SessionContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function DashboardPage() {
    const { user, isAuthenticated, loading } = useAuth()
    const { sessions, fetchSessions } = useSession()
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

                <div className="p-6 md:p-10 lg:p-12 max-w-6xl mx-auto space-y-10 pb-24 lg:pb-12">
                    {/* Welcome Section */}
                    <div className="flex flex-col gap-2">
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                            Ready to practice{user?.name ? `, ${user.name.split(' ')[0]}` : ''}?
                        </h1>
                        <p className="text-zinc-400 text-lg">Pick up where you left off or start a new analysis.</p>
                    </div>

                    {/* Action Cards */}
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Import Slides Card */}
                        <div className="group relative overflow-hidden rounded-2xl bg-surface-dark p-8 border border-border-dark hover:border-blue-500/50 transition-all cursor-pointer shadow-sm hover:shadow-xl hover:shadow-blue-500/10">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <span className="material-symbols-outlined text-9xl text-white">present_to_all</span>
                            </div>
                            <div className="relative z-10 flex flex-col h-full items-start">
                                <div className="h-14 w-14 rounded-xl bg-orange-900/20 text-[#F4B400] flex items-center justify-center mb-6">
                                    <span className="material-symbols-outlined text-3xl">slideshow</span>
                                </div>
                                <h3 className="text-xl font-bold mb-2 text-white">Import from Google Slides</h3>
                                <p className="text-zinc-400 mb-8">Connect your deck to get slide-by-slide feedback on pacing and content.</p>
                                <Link to="/practice" className="mt-auto text-sm font-bold text-primary group-hover:underline flex items-center gap-1">
                                    Connect Slides <span className="material-symbols-outlined text-base">arrow_forward</span>
                                </Link>
                            </div>
                        </div>

                        {/* Quick Practice Card */}
                        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-blue-700 p-8 text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] cursor-pointer">
                            <div className="absolute bottom-0 right-0 p-4 opacity-20">
                                <span className="material-symbols-outlined text-9xl">mic</span>
                            </div>
                            <div className="relative z-10 flex flex-col h-full items-start">
                                <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-6">
                                    <span className="material-symbols-outlined text-3xl">videocam</span>
                                </div>
                                <h3 className="text-xl font-bold mb-2">Quick Practice Session</h3>
                                <p className="text-blue-100 mb-8">Start an impromptu speech analysis without visual aids. Great for Q&A practice.</p>
                                <Link to="/practice" className="mt-auto py-2 px-4 bg-white text-primary rounded-lg text-sm font-bold hover:bg-gray-100 transition-colors flex items-center gap-2">
                                    Start Now <span className="material-symbols-outlined text-base">play_arrow</span>
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    {isAuthenticated && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-surface-dark border border-border-dark rounded-xl p-5 flex items-center gap-4">
                                <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400">
                                    <span className="material-symbols-outlined text-2xl">timer</span>
                                </div>
                                <div>
                                    <p className="text-zinc-400 text-sm">Practice Time</p>
                                    <p className="text-white text-xl font-bold">{formatTime(stats.totalPracticeTime)}</p>
                                </div>
                            </div>
                            <div className="bg-surface-dark border border-border-dark rounded-xl p-5 flex items-center gap-4">
                                <div className="p-3 rounded-lg bg-purple-500/10 text-purple-400">
                                    <span className="material-symbols-outlined text-2xl">mic</span>
                                </div>
                                <div>
                                    <p className="text-zinc-400 text-sm">Total Sessions</p>
                                    <p className="text-white text-xl font-bold">{stats.totalSessions}</p>
                                </div>
                            </div>
                            <div className="bg-surface-dark border border-border-dark rounded-xl p-5 flex items-center gap-4">
                                <div className="p-3 rounded-lg bg-green-500/10 text-green-400">
                                    <span className="material-symbols-outlined text-2xl">trending_up</span>
                                </div>
                                <div>
                                    <p className="text-zinc-400 text-sm">Avg Score</p>
                                    <p className="text-white text-xl font-bold">{stats.averageScore || '--'}</p>
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
