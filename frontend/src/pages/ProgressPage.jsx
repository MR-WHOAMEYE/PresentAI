import { Link } from 'react-router-dom'
import Sidebar from '../components/Layout/Sidebar'
import { useSession } from '../contexts/SessionContext'
import { useEffect, useState, useMemo } from 'react'

export default function ProgressPage() {
    const { sessions, fetchSessions } = useSession()
    const [animateCharts, setAnimateCharts] = useState(false)

    useEffect(() => {
        fetchSessions()
    }, [])

    // Trigger animations after data loads
    useEffect(() => {
        if (sessions.length > 0) {
            setTimeout(() => setAnimateCharts(true), 100)
        }
    }, [sessions])

    // Calculate stats
    const totalSessions = sessions.length
    const completedSessions = sessions.filter(s => s.overallScore)
    const avgScore = completedSessions.length > 0
        ? Math.round(completedSessions.reduce((sum, s) => sum + (s.overallScore || 0), 0) / completedSessions.length)
        : 0
    const totalTime = sessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0)
    const totalHours = (totalTime / 3600).toFixed(1)

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
                eyeContact: 0,
                posture: 0,
                pace: 0,
                clarity: 0,
                confidence: 0,
                engagement: 0
            }
        }

        // Average metrics across all completed sessions
        const totals = completedSessions.reduce((acc, session) => {
            const metrics = session.metrics || {}
            return {
                eyeContact: acc.eyeContact + (metrics.eyeContactPercent || 0),
                posture: acc.posture + (metrics.postureScore || 0),
                pace: acc.pace + calculatePaceScore(metrics.speechRate),
                clarity: acc.clarity + calculateClarityScore(metrics.fillerCount),
                confidence: acc.confidence + (metrics.confidence || (session.overallScore || 50)),
                engagement: acc.engagement + ((metrics.eyeContactPercent || 0) + (metrics.postureScore || 0)) / 2
            }
        }, { eyeContact: 0, posture: 0, pace: 0, clarity: 0, confidence: 0, engagement: 0 })

        const count = completedSessions.length
        return {
            eyeContact: Math.round(totals.eyeContact / count),
            posture: Math.round(totals.posture / count),
            pace: Math.round(totals.pace / count),
            clarity: Math.round(totals.clarity / count),
            confidence: Math.round(totals.confidence / count),
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
            skillBalance.eyeContact,
            skillBalance.posture,
            skillBalance.pace,
            skillBalance.clarity,
            skillBalance.confidence,
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

    // Skill labels with positions
    const skillLabels = [
        { name: 'Eye Contact', value: skillBalance.eyeContact, x: 100, y: 15 },
        { name: 'Posture', value: skillBalance.posture, x: 175, y: 55 },
        { name: 'Pace', value: skillBalance.pace, x: 175, y: 145 },
        { name: 'Clarity', value: skillBalance.clarity, x: 100, y: 190 },
        { name: 'Confidence', value: skillBalance.confidence, x: 25, y: 145 },
        { name: 'Engagement', value: skillBalance.engagement, x: 25, y: 55 }
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
                            {/* Skill labels */}
                            {completedSessions.length > 0 && (
                                <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs">
                                    {skillLabels.slice(0, 3).map((skill, i) => (
                                        <div key={i} className="flex flex-col items-center">
                                            <span className="text-zinc-400">{skill.name}</span>
                                            <span className={`font-bold ${skill.value >= 70 ? 'text-green-400' : skill.value >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                {skill.value}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
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
                                {sessions.map((session, index) => (
                                    <div
                                        key={session.id}
                                        className="flex items-center justify-between p-4 rounded-lg bg-background-dark border border-border-dark hover:border-zinc-700 transition-all duration-300 hover:scale-[1.01]"
                                        style={{
                                            opacity: animateCharts ? 1 : 0,
                                            transform: animateCharts ? 'translateY(0)' : 'translateY(10px)',
                                            transition: `opacity 0.3s ease-out ${index * 50}ms, transform 0.3s ease-out ${index * 50}ms`
                                        }}
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
                                                <span className={`text-2xl font-bold ${session.overallScore >= 70 ? 'text-green-400' : session.overallScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                    {session.overallScore}
                                                </span>
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
