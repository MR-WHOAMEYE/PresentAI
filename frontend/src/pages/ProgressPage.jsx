import { Link } from 'react-router-dom'
import Sidebar from '../components/Layout/Sidebar'
import { useSession } from '../contexts/SessionContext'
import { useEffect, useState, useMemo } from 'react'

export default function ProgressPage() {
    const { sessions, fetchSessions } = useSession()
    const [animateCharts, setAnimateCharts] = useState(false)
    const [showSessionHistory, setShowSessionHistory] = useState(false)
    const [dateFilter, setDateFilter] = useState('all') // 'week' | 'month' | 'all'
    const [selectedSession, setSelectedSession] = useState(null) // For feedback modal

    useEffect(() => {
        fetchSessions()
    }, [])

    // Trigger animations after data loads
    useEffect(() => {
        if (sessions.length > 0) {
            setTimeout(() => setAnimateCharts(true), 100)
        }
    }, [sessions])

    // Filter sessions by date range
    const filteredSessions = useMemo(() => {
        if (dateFilter === 'all') return sessions

        const now = new Date()
        const cutoff = new Date()

        if (dateFilter === 'week') {
            cutoff.setDate(now.getDate() - 7)
        } else if (dateFilter === 'month') {
            cutoff.setMonth(now.getMonth() - 1)
        }

        return sessions.filter(s => {
            const sessionDate = new Date(s.createdAt || s.startedAt)
            return sessionDate >= cutoff
        })
    }, [sessions, dateFilter])

    // Calculate stats from filtered sessions
    const totalSessions = filteredSessions.length
    const completedSessions = filteredSessions.filter(s => s.overallScore)
    const avgScore = completedSessions.length > 0
        ? Math.round(completedSessions.reduce((sum, s) => sum + (s.overallScore || 0), 0) / completedSessions.length)
        : 0
    const totalTime = filteredSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0)
    const totalHours = (totalTime / 3600).toFixed(1)

    // Format date helper
    const formatDate = (dateStr) => {
        if (!dateStr) return ''
        const date = new Date(dateStr)
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        })
    }

    // Generate Score Trend data from real sessions
    const scoreTrendData = useMemo(() => {
        if (completedSessions.length === 0) {
            return { points: [], path: '', areaPath: '' }
        }

        // Get last 10 sessions, sorted by date
        const recentSessions = [...completedSessions]
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
            .slice(-10)

        if (recentSessions.length < 2) {
            const score = recentSessions[0]?.overallScore || 50
            const y = 100 - score
            return {
                points: [{ x: 50, y, score }],
                path: `M0,${y} L100,${y}`,
                areaPath: `M0,${y} L100,${y} L100,100 L0,100 Z`
            }
        }

        // Map sessions to chart coordinates
        const points = recentSessions.map((session, i) => {
            const x = (i / (recentSessions.length - 1)) * 100
            const y = 100 - (session.overallScore || 50) // Invert for SVG coords
            return { x, y, score: session.overallScore, date: session.createdAt }
        })

        // Generate smooth curve path using bezier curves
        let path = `M${points[0].x},${points[0].y}`
        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1]
            const curr = points[i]
            const cpX = (prev.x + curr.x) / 2
            path += ` C${cpX},${prev.y} ${cpX},${curr.y} ${curr.x},${curr.y}`
        }

        // Area path for gradient fill
        const areaPath = path + ` L100,100 L0,100 Z`

        return { points, path, areaPath }
    }, [completedSessions])

    // Calculate Skill Balance from session metrics
    const skillBalance = useMemo(() => {
        if (completedSessions.length === 0) {
            return {
                audienceFocus: 0,
                headPose: 0,
                posture: 0,
                pace: 0,
                clarity: 0,
                engagement: 0
            }
        }

        // Average metrics across all completed sessions
        const totals = completedSessions.reduce((acc, session) => {
            const metrics = session.metrics || {}
            const headPose = metrics.headPose || {}
            const engagement = metrics.engagement || {}

            // Calculate head pose score based on yaw deviation (facing audience)
            const yaw = Math.abs(headPose.yaw || 0)
            const headPoseScore = yaw >= 20 ? 90 : yaw >= 15 ? 75 : yaw >= 10 ? 60 : 40

            // Engagement score from the engagement object or fallback
            const engagementScore = engagement.score ||
                ((metrics.eyeContactPercent || 0) + (metrics.postureScore || 0)) / 2

            return {
                audienceFocus: acc.audienceFocus + (metrics.eyeContactPercent || 0),
                headPose: acc.headPose + headPoseScore,
                posture: acc.posture + (metrics.postureScore || 0),
                pace: acc.pace + calculatePaceScore(metrics.speechRate),
                clarity: acc.clarity + calculateClarityScore(metrics.fillerCount),
                engagement: acc.engagement + engagementScore
            }
        }, { audienceFocus: 0, headPose: 0, posture: 0, pace: 0, clarity: 0, engagement: 0 })

        const count = completedSessions.length
        return {
            audienceFocus: Math.round(totals.audienceFocus / count),
            headPose: Math.round(totals.headPose / count),
            posture: Math.round(totals.posture / count),
            pace: Math.round(totals.pace / count),
            clarity: Math.round(totals.clarity / count),
            engagement: Math.round(totals.engagement / count)
        }
    }, [completedSessions])

    // Helper: Convert speech rate to score (120-150 WPM is optimal)
    function calculatePaceScore(wpm) {
        if (!wpm) return 50
        if (wpm >= 120 && wpm <= 150) return 100
        if (wpm < 100 || wpm > 180) return 40
        return 70
    }

    // Helper: Convert filler count to clarity score
    function calculateClarityScore(fillerCount) {
        if (fillerCount === undefined) return 50
        if (fillerCount === 0) return 100
        if (fillerCount <= 3) return 85
        if (fillerCount <= 6) return 70
        if (fillerCount <= 10) return 55
        return 40
    }

    // Generate radar chart polygon points
    const radarPoints = useMemo(() => {
        const skills = [
            skillBalance.audienceFocus,
            skillBalance.headPose,
            skillBalance.posture,
            skillBalance.pace,
            skillBalance.clarity,
            skillBalance.engagement
        ]

        const center = 100
        const radius = 70
        const angleStep = (2 * Math.PI) / 6
        const startAngle = -Math.PI / 2 // Start from top

        return skills.map((value, i) => {
            const angle = startAngle + i * angleStep
            const r = (value / 100) * radius
            const x = center + r * Math.cos(angle)
            const y = center + r * Math.sin(angle)
            return `${x},${y}`
        }).join(' ')
    }, [skillBalance])

    // Skill labels with positions and icons
    const skillLabels = [
        { name: 'Audience Focus', value: skillBalance.audienceFocus, icon: 'visibility', x: 100, y: 15 },
        { name: 'Head Pose', value: skillBalance.headPose, icon: 'face', x: 175, y: 55 },
        { name: 'Posture', value: skillBalance.posture, icon: 'accessibility_new', x: 175, y: 145 },
        { name: 'Pace', value: skillBalance.pace, icon: 'speed', x: 100, y: 190 },
        { name: 'Clarity', value: skillBalance.clarity, icon: 'mic', x: 25, y: 145 },
        { name: 'Engagement', value: skillBalance.engagement, icon: 'groups', x: 25, y: 55 }
    ]

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
                                <button
                                    onClick={() => setDateFilter('week')}
                                    className={`px-3 md:px-4 py-1.5 rounded text-xs md:text-sm font-medium transition-colors ${dateFilter === 'week'
                                        ? 'bg-surface-dark text-white font-bold shadow-sm border border-border-dark'
                                        : 'text-text-secondary hover:text-white'
                                        }`}
                                >
                                    Week
                                </button>
                                <button
                                    onClick={() => setDateFilter('month')}
                                    className={`px-3 md:px-4 py-1.5 rounded text-xs md:text-sm font-medium transition-colors ${dateFilter === 'month'
                                        ? 'bg-surface-dark text-white font-bold shadow-sm border border-border-dark'
                                        : 'text-text-secondary hover:text-white'
                                        }`}
                                >
                                    Month
                                </button>
                                <button
                                    onClick={() => setDateFilter('all')}
                                    className={`px-3 md:px-4 py-1.5 rounded text-xs md:text-sm font-medium transition-colors ${dateFilter === 'all'
                                        ? 'bg-surface-dark text-white font-bold shadow-sm border border-border-dark'
                                        : 'text-text-secondary hover:text-white'
                                        }`}
                                >
                                    All Time
                                </button>
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
                        {/* Score Trend Chart */}
                        <div className="lg:col-span-2 bg-surface-dark border border-border-dark rounded-xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-white text-lg font-bold">Score Trend</h3>
                                    <p className="text-text-secondary text-sm">Overall performance over time</p>
                                </div>
                                {completedSessions.length > 0 && (
                                    <div className="text-right">
                                        <span className="text-2xl font-bold text-white">{completedSessions[completedSessions.length - 1]?.overallScore || '--'}</span>
                                        <p className="text-xs text-zinc-500">Latest Score</p>
                                    </div>
                                )}
                            </div>
                            <div className="relative w-full h-[300px] flex items-end gap-2 pt-10">
                                {completedSessions.length === 0 ? (
                                    <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
                                        <div className="text-center">
                                            <span className="material-symbols-outlined text-4xl mb-2">show_chart</span>
                                            <p>Complete sessions to see your score trend</p>
                                        </div>
                                    </div>
                                ) : (
                                    <svg className="w-full h-full absolute inset-0 z-10" preserveAspectRatio="none" viewBox="0 0 100 100">
                                        <defs>
                                            <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                                                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                                                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                            </linearGradient>
                                        </defs>
                                        {/* Grid lines */}
                                        <g stroke="#333" strokeWidth="0.5" opacity="0.5">
                                            <line x1="0" y1="25" x2="100" y2="25" />
                                            <line x1="0" y1="50" x2="100" y2="50" />
                                            <line x1="0" y1="75" x2="100" y2="75" />
                                        </g>
                                        {/* Animated area fill */}
                                        <path
                                            d={scoreTrendData.areaPath}
                                            fill="url(#chartGradient)"
                                            className={`transition-all duration-1000 ease-out ${animateCharts ? 'opacity-100' : 'opacity-0'}`}
                                        />
                                        {/* Animated line */}
                                        <path
                                            d={scoreTrendData.path}
                                            fill="none"
                                            stroke="#3b82f6"
                                            strokeWidth="2"
                                            vectorEffect="non-scaling-stroke"
                                            className={`transition-all duration-1000 ease-out`}
                                            style={{
                                                strokeDasharray: animateCharts ? '0' : '1000',
                                                strokeDashoffset: animateCharts ? '0' : '1000',
                                                transition: 'stroke-dasharray 1.5s ease-out, stroke-dashoffset 1.5s ease-out'
                                            }}
                                        />
                                        {/* Data points */}
                                        {scoreTrendData.points.map((point, i) => (
                                            <g key={i}>
                                                <circle
                                                    cx={point.x}
                                                    cy={point.y}
                                                    r={animateCharts ? 3 : 0}
                                                    fill="#3b82f6"
                                                    stroke="#18181b"
                                                    strokeWidth="2"
                                                    className="transition-all duration-500 ease-out"
                                                    style={{ transitionDelay: `${i * 100 + 500}ms` }}
                                                />
                                                {/* Tooltip on hover - simplified for SVG */}
                                                <title>Score: {point.score}</title>
                                            </g>
                                        ))}
                                    </svg>
                                )}
                                {/* Y-axis labels */}
                                <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-zinc-600 -ml-6">
                                    <span>100</span>
                                    <span>75</span>
                                    <span>50</span>
                                    <span>25</span>
                                    <span>0</span>
                                </div>
                            </div>
                        </div>

                        {/* Skill Balance Radar */}
                        <div className="bg-surface-dark border border-border-dark rounded-xl p-6 flex flex-col">
                            <div className="mb-4">
                                <h3 className="text-white text-lg font-bold">Skill Balance</h3>
                                <p className="text-text-secondary text-sm">Your strengths & areas to improve</p>
                            </div>
                            <div className="flex-1 flex items-center justify-center relative">
                                {completedSessions.length === 0 ? (
                                    <div className="text-center text-zinc-500">
                                        <span className="material-symbols-outlined text-4xl mb-2">radar</span>
                                        <p className="text-sm">Complete sessions to see skill analysis</p>
                                    </div>
                                ) : (
                                    <svg className="w-full max-w-[200px]" viewBox="0 0 200 200">
                                        {/* Background hexagon grids */}
                                        <g fill="none" opacity="0.3" stroke="#333333" strokeWidth="1">
                                            <polygon points="100,30 161,65 161,135 100,170 39,135 39,65" />
                                            <polygon points="100,45 147,72.5 147,127.5 100,155 53,127.5 53,72.5" />
                                            <polygon points="100,60 133,80 133,120 100,140 67,120 67,80" />
                                            <polygon points="100,75 119,87.5 119,112.5 100,125 81,112.5 81,87.5" />
                                        </g>
                                        {/* Axis lines */}
                                        <g stroke="#333" strokeWidth="0.5" opacity="0.5">
                                            <line x1="100" y1="30" x2="100" y2="170" />
                                            <line x1="39" y1="65" x2="161" y2="135" />
                                            <line x1="39" y1="135" x2="161" y2="65" />
                                        </g>
                                        {/* Animated data polygon */}
                                        <polygon
                                            points={animateCharts ? radarPoints : "100,100 100,100 100,100 100,100 100,100 100,100"}
                                            fill="rgba(59, 130, 246, 0.2)"
                                            stroke="#3b82f6"
                                            strokeWidth="2"
                                            className="transition-all duration-1000 ease-out"
                                        />
                                        {/* Data point dots */}
                                        {animateCharts && skillLabels.map((skill, i) => {
                                            const center = 100
                                            const radius = 70
                                            const angleStep = (2 * Math.PI) / 6
                                            const startAngle = -Math.PI / 2
                                            const angle = startAngle + i * angleStep
                                            const r = (skill.value / 100) * radius
                                            const x = center + r * Math.cos(angle)
                                            const y = center + r * Math.sin(angle)
                                            return (
                                                <circle
                                                    key={i}
                                                    cx={x}
                                                    cy={y}
                                                    r="4"
                                                    fill="#3b82f6"
                                                    stroke="#18181b"
                                                    strokeWidth="2"
                                                    className="transition-all duration-500"
                                                    style={{ transitionDelay: `${i * 100 + 500}ms` }}
                                                >
                                                    <title>{skill.name}: {skill.value}%</title>
                                                </circle>
                                            )
                                        })}
                                    </svg>
                                )}
                            </div>
                            {/* Skill labels with icons */}
                            {completedSessions.length > 0 && (
                                <div className="grid grid-cols-2 gap-3 mt-4">
                                    {skillLabels.map((skill, i) => (
                                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-background-dark/50">
                                            <span className={`material-symbols-outlined text-[16px] ${skill.value >= 70 ? 'text-green-400' :
                                                skill.value >= 50 ? 'text-yellow-400' : 'text-red-400'
                                                }`}>
                                                {skill.icon}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-zinc-400 text-[10px] truncate">{skill.name}</p>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-1000 ${skill.value >= 70 ? 'bg-green-500' :
                                                                skill.value >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                                                }`}
                                                            style={{ width: animateCharts ? `${skill.value}%` : '0%' }}
                                                        />
                                                    </div>
                                                    <span className={`text-xs font-bold ${skill.value >= 70 ? 'text-green-400' :
                                                        skill.value >= 50 ? 'text-yellow-400' : 'text-red-400'
                                                        }`}>
                                                        {skill.value}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Session History - Hidden on mobile by default */}
                    <div className="bg-surface-dark border border-border-dark rounded-xl p-4 md:p-6">
                        {/* Mobile: Collapsible header */}
                        <button
                            onClick={() => setShowSessionHistory(!showSessionHistory)}
                            className="md:hidden w-full flex items-center justify-between text-white text-lg font-bold"
                        >
                            <span>Session History ({filteredSessions.length})</span>
                            <span className="material-symbols-outlined text-zinc-400">
                                {showSessionHistory ? 'expand_less' : 'expand_more'}
                            </span>
                        </button>
                        {/* Desktop: Always visible header */}
                        <div className="hidden md:flex items-center justify-between mb-4">
                            <h3 className="text-white text-lg font-bold">Session History</h3>
                            <span className="text-zinc-500 text-sm">{filteredSessions.length} sessions</span>
                        </div>

                        {/* Content - hidden on mobile unless expanded */}
                        <div className={`${showSessionHistory ? 'block mt-4' : 'hidden'} md:block`}>
                            {filteredSessions.length === 0 ? (
                                <div className="text-center py-8 md:py-12">
                                    <span className="material-symbols-outlined text-4xl md:text-6xl text-zinc-700 mb-4">history</span>
                                    <p className="text-zinc-500 text-sm md:text-base">
                                        {sessions.length === 0
                                            ? 'No sessions yet. Start practicing!'
                                            : `No sessions in the selected ${dateFilter === 'week' ? 'week' : dateFilter === 'month' ? 'month' : 'time period'}`}
                                    </p>
                                    <Link to="/practice" className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
                                        <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                                        Start Practice
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-2 md:space-y-3">
                                    {filteredSessions.slice(0, showSessionHistory ? filteredSessions.length : 5).map((session, index) => (
                                        <button
                                            key={session.id}
                                            onClick={() => setSelectedSession(session)}
                                            className="w-full flex items-center justify-between p-3 md:p-4 rounded-lg bg-background-dark border border-border-dark hover:border-primary/50 hover:bg-surface-dark transition-all duration-300 hover:scale-[1.01] cursor-pointer text-left"
                                            style={{
                                                opacity: animateCharts ? 1 : 0,
                                                transform: animateCharts ? 'translateY(0)' : 'translateY(10px)',
                                                transition: `opacity 0.3s ease-out ${index * 50}ms, transform 0.3s ease-out ${index * 50}ms`
                                            }}
                                        >
                                            <div className="flex items-center gap-3 md:gap-4 min-w-0">
                                                <div className="p-1.5 md:p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                                                    <span className="material-symbols-outlined text-lg md:text-2xl">videocam</span>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-white font-medium text-sm md:text-base truncate">{session.presentationTitle || 'Practice Session'}</p>
                                                    <p className="text-zinc-500 text-xs md:text-sm">
                                                        {formatDate(session.createdAt || session.startedAt)} •
                                                        {session.durationSeconds ? ` ${Math.round(session.durationSeconds / 60)}m` : ' --'}
                                                        {session.aiFeedback && <span className="text-primary ml-1">• Has Feedback</span>}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                                {session.overallScore && (
                                                    <div className="text-right">
                                                        <span className={`text-lg md:text-2xl font-bold ${session.overallScore >= 70 ? 'text-green-400' : session.overallScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                            {session.overallScore}
                                                        </span>
                                                        <span className="text-zinc-500 text-xs md:text-sm">/100</span>
                                                    </div>
                                                )}
                                                <span className="material-symbols-outlined text-zinc-600 text-lg">chevron_right</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Session Detail Modal */}
            {selectedSession && (
                <div
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedSession(null)}
                >
                    <div
                        className="bg-surface-dark border border-border-dark rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 md:p-6 border-b border-border-dark">
                            <div>
                                <h2 className="text-white text-lg md:text-xl font-bold">{selectedSession.presentationTitle || 'Practice Session'}</h2>
                                <p className="text-zinc-400 text-sm">
                                    {formatDate(selectedSession.createdAt || selectedSession.startedAt)} •
                                    {selectedSession.durationSeconds ? ` ${Math.round(selectedSession.durationSeconds / 60)} minutes` : ''}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {selectedSession.overallScore && (
                                    <div className={`text-2xl md:text-3xl font-bold ${selectedSession.overallScore >= 70 ? 'text-green-400' : selectedSession.overallScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                        {selectedSession.overallScore}
                                        <span className="text-zinc-500 text-sm font-normal">/100</span>
                                    </div>
                                )}
                                <button
                                    onClick={() => setSelectedSession(null)}
                                    className="p-2 rounded-lg hover:bg-background-dark transition-colors"
                                >
                                    <span className="material-symbols-outlined text-zinc-400">close</span>
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="p-4 md:p-6 overflow-y-auto max-h-[60vh] space-y-6">
                            {/* AI Feedback */}
                            {selectedSession.aiFeedback ? (
                                <>
                                    {/* Summary */}
                                    {selectedSession.aiFeedback.summary && (
                                        <div>
                                            <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                                                <span className="material-symbols-outlined text-primary">psychology</span>
                                                AI Summary
                                            </h3>
                                            <p className="text-zinc-300 text-sm leading-relaxed">{selectedSession.aiFeedback.summary}</p>
                                        </div>
                                    )}

                                    {/* Insights */}
                                    {selectedSession.aiFeedback.naturalInsights?.length > 0 && (
                                        <div>
                                            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                                                <span className="material-symbols-outlined text-blue-400">lightbulb</span>
                                                Key Insights
                                            </h3>
                                            <div className="space-y-2">
                                                {selectedSession.aiFeedback.naturalInsights.map((insight, i) => (
                                                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-background-dark/50">
                                                        <span className="text-blue-400 mt-0.5">•</span>
                                                        <p className="text-zinc-300 text-sm">{insight}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Positives & Improvements */}
                                    <div className="grid md:grid-cols-2 gap-4">
                                        {selectedSession.aiFeedback.positives?.length > 0 && (
                                            <div>
                                                <h4 className="text-green-400 font-medium mb-2 flex items-center gap-2 text-sm">
                                                    <span className="material-symbols-outlined text-[18px]">thumb_up</span>
                                                    Strengths
                                                </h4>
                                                <ul className="space-y-1">
                                                    {selectedSession.aiFeedback.positives.map((item, i) => (
                                                        <li key={i} className="text-zinc-400 text-sm flex items-start gap-2">
                                                            <span className="text-green-500">✓</span> {item}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {selectedSession.aiFeedback.improvements?.length > 0 && (
                                            <div>
                                                <h4 className="text-yellow-400 font-medium mb-2 flex items-center gap-2 text-sm">
                                                    <span className="material-symbols-outlined text-[18px]">trending_up</span>
                                                    Areas to Improve
                                                </h4>
                                                <ul className="space-y-1">
                                                    {selectedSession.aiFeedback.improvements.map((item, i) => (
                                                        <li key={i} className="text-zinc-400 text-sm flex items-start gap-2">
                                                            <span className="text-yellow-500">→</span> {item}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>

                                    {/* Goals */}
                                    {selectedSession.aiFeedback.nextSessionGoals?.length > 0 && (
                                        <div>
                                            <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                                                <span className="material-symbols-outlined text-purple-400">flag</span>
                                                Next Session Goals
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedSession.aiFeedback.nextSessionGoals.map((goal, i) => (
                                                    <span key={i} className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs">
                                                        {goal}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <span className="material-symbols-outlined text-4xl text-zinc-700 mb-2">feedback</span>
                                    <p className="text-zinc-500">No AI feedback available for this session</p>
                                </div>
                            )}

                            {/* Session Metrics */}
                            {selectedSession.metrics && Object.keys(selectedSession.metrics).length > 0 && (
                                <div>
                                    <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-cyan-400">analytics</span>
                                        Session Metrics
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {selectedSession.metrics.eyeContactPercent !== undefined && (
                                            <div className="bg-background-dark/50 p-3 rounded-lg text-center">
                                                <p className="text-zinc-500 text-xs">Audience Focus</p>
                                                <p className="text-white text-lg font-bold">{Math.round(selectedSession.metrics.eyeContactPercent)}%</p>
                                            </div>
                                        )}
                                        {selectedSession.metrics.postureScore !== undefined && (
                                            <div className="bg-background-dark/50 p-3 rounded-lg text-center">
                                                <p className="text-zinc-500 text-xs">Posture</p>
                                                <p className="text-white text-lg font-bold">{Math.round(selectedSession.metrics.postureScore)}%</p>
                                            </div>
                                        )}
                                        {selectedSession.metrics.speechRate !== undefined && (
                                            <div className="bg-background-dark/50 p-3 rounded-lg text-center">
                                                <p className="text-zinc-500 text-xs">Speech Rate</p>
                                                <p className="text-white text-lg font-bold">{selectedSession.metrics.speechRate} WPM</p>
                                            </div>
                                        )}
                                        {selectedSession.metrics.fillerCount !== undefined && (
                                            <div className="bg-background-dark/50 p-3 rounded-lg text-center">
                                                <p className="text-zinc-500 text-xs">Filler Words</p>
                                                <p className="text-white text-lg font-bold">{selectedSession.metrics.fillerCount}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-between p-4 border-t border-border-dark">
                            <button
                                onClick={() => setSelectedSession(null)}
                                className="px-4 py-2 text-zinc-400 hover:text-white transition-colors text-sm"
                            >
                                Close
                            </button>
                            <Link
                                to="/practice"
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                                New Practice
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
