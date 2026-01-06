import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Layout/Sidebar'
import { useAuth } from '../contexts/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function SettingsPage() {
    const { user, isAuthenticated } = useAuth()
    const [settings, setSettings] = useState({
        eyeContact: true,
        fillerWords: true,
        posture: true,
        sensitivity: 80,
        feedbackTiming: 'post',
        voiceEnabled: false,
        voiceId: 'Rachel',
        voiceSpeed: 1.0,
        presentationStyle: 'Professional & Corporate'
    })
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState(null)

    const profileRef = useRef(null)
    const integrationsRef = useRef(null)
    const preferencesRef = useRef(null)

    // Load settings from user context or backend
    useEffect(() => {
        if (user?.preferences) {
            setSettings(user.preferences)
        }
    }, [user])

    function handleToggle(key) {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const scrollToSection = (ref) => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    async function handleSave() {
        setSaving(true)
        setMessage({ type: 'info', text: 'Saving changes...' })
        try {
            const response = await fetch(`${API_URL}/auth/preferences`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(settings)
            })

            if (response.ok) {
                setMessage({ type: 'success', text: 'Settings saved successfully!' })
                // Also update local storage for TTS service
                localStorage.setItem('tts_settings', JSON.stringify({
                    isEnabled: settings.voiceEnabled,
                    voiceId: settings.voiceId,
                    speed: settings.voiceSpeed
                }))
            } else {
                throw new Error('Failed to save')
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' })
        }
        setSaving(false)
        setTimeout(() => setMessage(null), 3000)
    }

    function handleDiscard() {
        if (user?.preferences) {
            setSettings(user.preferences)
        }
        setMessage({ type: 'info', text: 'Changes discarded' })
        setTimeout(() => setMessage(null), 2000)
    }

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background-dark font-display text-white">
            <Sidebar />

            <main className="flex-1 flex flex-col h-full bg-background-dark relative overflow-hidden">
                {/* Header */}
                <header className="h-16 border-b border-border-dark flex items-center justify-between px-8 bg-background-dark/50 backdrop-blur-sm z-10 shrink-0">
                    <div className="flex items-center gap-2 text-sm">
                        <Link to="/" className="text-text-secondary hover:text-white transition-colors">Home</Link>
                        <span className="text-border-dark">/</span>
                        <span className="text-white font-medium">Settings</span>
                    </div>
                    <div className="flex items-center gap-4">
                        {message && (
                            <span className={`text-xs px-3 py-1 rounded-full border ${message.type === 'success' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                message.type === 'error' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                    'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                }`}>
                                {message.text}
                            </span>
                        )}
                        <button className="relative p-2 text-text-secondary hover:text-white hover:bg-surface-dark rounded-full transition-colors">
                            <span className="material-symbols-outlined">notifications</span>
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 scroll-smooth">
                    <div className="max-w-[960px] mx-auto space-y-8 pb-32">
                        {/* Title */}
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Settings</h1>
                            <p className="text-text-secondary">Manage your profile, connected apps, and AI analysis preferences.</p>
                        </div>

                        {/* Tabs */}
                        <div className="border-b border-border-dark sticky top-0 bg-background-dark z-20 py-2">
                            <div className="flex gap-8">
                                <button onClick={() => scrollToSection(profileRef)} className="pb-3 border-b-2 border-primary text-white font-medium text-sm transition-all hover:text-primary">Profile</button>
                                <button onClick={() => scrollToSection(integrationsRef)} className="pb-3 border-b-2 border-transparent text-text-secondary hover:text-white font-medium text-sm transition-colors">Integrations</button>
                                <button onClick={() => scrollToSection(preferencesRef)} className="pb-3 border-b-2 border-transparent text-text-secondary hover:text-white font-medium text-sm transition-colors">Preferences</button>
                            </div>
                        </div>

                        {/* Profile Section */}
                        <section ref={profileRef} className="space-y-6 scroll-mt-24">
                            <div className="flex justify-between items-end border-b border-border-dark pb-2">
                                <h2 className="text-lg font-semibold text-white">Profile Information</h2>
                            </div>
                            <div className="flex flex-col md:flex-row gap-8 items-start">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="relative group">
                                        <div
                                            className="w-32 h-32 rounded-full bg-cover bg-center border-4 border-surface-dark shadow-xl bg-primary flex items-center justify-center overflow-hidden"
                                        >
                                            {user?.picture ? (
                                                <img src={user.picture} alt={user.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-4xl font-bold text-white">{user?.name?.[0] || 'U'}</span>
                                            )}
                                        </div>
                                        <button className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full hover:bg-blue-600 transition-colors shadow-lg border-2 border-background-dark">
                                            <span className="material-symbols-outlined text-lg">edit</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-text-secondary">Full Name</label>
                                        <input
                                            className="w-full bg-surface-dark border border-border-dark rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                            type="text"
                                            defaultValue={user?.name || ''}
                                            readOnly
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-text-secondary">Email Address</label>
                                        <input
                                            className="w-full bg-surface-dark border border-border-dark rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                            type="email"
                                            defaultValue={user?.email || ''}
                                            readOnly
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-sm font-medium text-text-secondary">Presentation Style</label>
                                        <div className="relative">
                                            <select
                                                className="w-full bg-surface-dark border border-border-dark rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary appearance-none transition-all"
                                                value={settings.presentationStyle}
                                                onChange={(e) => setSettings(prev => ({ ...prev, presentationStyle: e.target.value }))}
                                            >
                                                <option>Professional & Corporate</option>
                                                <option>Casual & Conversational</option>
                                                <option>TED-style Storytelling</option>
                                                <option>Academic & Research</option>
                                            </select>
                                            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none">expand_more</span>
                                        </div>
                                        <p className="text-xs text-text-secondary mt-1">This helps the AI tailor feedback to your specific context.</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Integrations */}
                        <section ref={integrationsRef} className="space-y-6 pt-6 scroll-mt-24">
                            <div className="flex justify-between items-end border-b border-border-dark pb-2">
                                <h2 className="text-lg font-semibold text-white">Integrations</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className={`bg-surface-dark border ${user?.hasGoogleToken ? 'border-primary/30' : 'border-border-dark'} rounded-xl p-5 flex flex-col justify-between h-40 relative overflow-hidden group hover:border-primary/50 transition-colors`}>
                                    <div className="absolute top-0 right-0 p-3">
                                        {user?.hasGoogleToken ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                                Connected
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                                                Not Connected
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shrink-0">
                                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24">
                                                <rect fill="#F4B400" height="18" rx="2" width="18" x="3" y="3" />
                                                <path d="M7 8H17M7 12H17M7 16H13" stroke="white" strokeWidth="2" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white">Google Slides</h3>
                                            <p className="text-sm text-text-secondary">Sync your decks automatically</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-border-dark/50">
                                        <span className="text-xs text-text-secondary">
                                            {user?.hasGoogleToken ? 'Connected via Google OAuth' : 'Authorize to import slides'}
                                        </span>
                                        {user?.hasGoogleToken ? (
                                            <button className="text-sm font-medium text-text-secondary hover:text-white transition-colors">Manage</button>
                                        ) : (
                                            <button onClick={() => window.location.href = '/auth/google'} className="text-sm font-medium text-primary hover:text-blue-400 transition-colors font-bold">Connect</button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Preferences */}
                        <section ref={preferencesRef} className="space-y-6 pt-6 scroll-mt-24">
                            <div className="flex justify-between items-end border-b border-border-dark pb-2">
                                <h2 className="text-lg font-semibold text-white">Feedback Preferences</h2>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 space-y-4 bg-surface-dark rounded-xl p-6 border border-border-dark">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Metrics to Track</h3>

                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-white font-medium">Eye Contact Analysis</span>
                                            <span className="text-xs text-text-secondary">Track gaze focus on camera/audience</span>
                                        </div>
                                        <button
                                            onClick={() => handleToggle('eyeContact')}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${settings.eyeContact ? 'bg-primary' : 'bg-zinc-700'}`}
                                        >
                                            <div className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-all ${settings.eyeContact ? 'right-0.5' : 'left-0.5'}`} />
                                        </button>
                                    </div>

                                    <hr className="border-border-dark" />

                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-white font-medium">Filler Word Detection</span>
                                            <span className="text-xs text-text-secondary">Highlight usage of "um", "ah", "like"</span>
                                        </div>
                                        <button
                                            onClick={() => handleToggle('fillerWords')}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${settings.fillerWords ? 'bg-primary' : 'bg-zinc-700'}`}
                                        >
                                            <div className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-all ${settings.fillerWords ? 'right-0.5' : 'left-0.5'}`} />
                                        </button>
                                    </div>

                                    <hr className="border-border-dark" />

                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-white font-medium">Posture & Gestures</span>
                                            <span className="text-xs text-text-secondary">Monitor body language and hand movements</span>
                                        </div>
                                        <button
                                            onClick={() => handleToggle('posture')}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${settings.posture ? 'bg-primary' : 'bg-zinc-700'}`}
                                        >
                                            <div className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-all ${settings.posture ? 'right-0.5' : 'left-0.5'}`} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="bg-surface-dark rounded-xl p-6 border border-border-dark">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">AI Sensitivity</h3>
                                            <span className="text-xs font-mono text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                                                {settings.sensitivity >= 70 ? 'High' : settings.sensitivity >= 40 ? 'Medium' : 'Low'}
                                            </span>
                                        </div>
                                        <div className="space-y-4">
                                            <input
                                                className="w-full h-2 bg-border-dark rounded-lg appearance-none cursor-pointer"
                                                max="100"
                                                min="1"
                                                type="range"
                                                value={settings.sensitivity}
                                                onChange={(e) => setSettings(prev => ({ ...prev, sensitivity: parseInt(e.target.value) }))}
                                            />
                                            <div className="flex justify-between text-xs text-text-secondary">
                                                <span>Lenient</span>
                                                <span>Strict</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-text-secondary mt-4 leading-relaxed">
                                            Higher sensitivity means the AI will flag even minor pauses or slight gaze shifts.
                                        </p>
                                    </div>

                                    <div className="bg-surface-dark rounded-xl p-6 border border-border-dark">
                                        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Feedback Timing</h3>
                                        <div className="space-y-3">
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <input
                                                    type="radio"
                                                    name="timing"
                                                    checked={settings.feedbackTiming === 'post'}
                                                    onChange={() => setSettings(prev => ({ ...prev, feedbackTiming: 'post' }))}
                                                    className="h-4 w-4 text-primary focus:ring-primary/50 bg-transparent border-zinc-600"
                                                />
                                                <span className="text-sm text-white group-hover:text-primary transition-colors">Post-presentation only</span>
                                            </label>
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <input
                                                    type="radio"
                                                    name="timing"
                                                    checked={settings.feedbackTiming === 'realtime'}
                                                    onChange={() => setSettings(prev => ({ ...prev, feedbackTiming: 'realtime' }))}
                                                    className="h-4 w-4 text-primary focus:ring-primary/50 bg-transparent border-zinc-600"
                                                />
                                                <span className="text-sm text-white group-hover:text-primary transition-colors">Real-time HUD</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Voice Feedback (TTS) */}
                        <section className="space-y-6 pt-6">
                            <div className="flex justify-between items-end border-b border-border-dark pb-2">
                                <h2 className="text-lg font-semibold text-white">Voice Feedback</h2>
                                <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">Powered by ElevenLabs</span>
                            </div>
                            <div className="bg-surface-dark rounded-xl p-6 border border-border-dark space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-white font-medium">Enable Voice Feedback</span>
                                        <span className="text-xs text-text-secondary">AI coach reads feedback aloud using natural voice</span>
                                    </div>
                                    <button
                                        onClick={() => setSettings(prev => ({ ...prev, voiceEnabled: !prev.voiceEnabled }))}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${settings.voiceEnabled ? 'bg-primary' : 'bg-zinc-700'}`}
                                    >
                                        <div className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-all ${settings.voiceEnabled ? 'right-0.5' : 'left-0.5'}`} />
                                    </button>
                                </div>

                                <hr className="border-border-dark" />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-text-secondary">Voice</label>
                                        <div className="relative">
                                            <select
                                                className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary appearance-none transition-all"
                                                value={settings.voiceId || 'Rachel'}
                                                onChange={(e) => setSettings(prev => ({ ...prev, voiceId: e.target.value }))}
                                            >
                                                <option value="Rachel">Rachel (Female, Calm)</option>
                                                <option value="Drew">Drew (Male, Professional)</option>
                                                <option value="Paul">Paul (Male, News)</option>
                                                <option value="Domi">Domi (Female, Strong)</option>
                                                <option value="Dave">Dave (Male, Conversational)</option>
                                                <option value="Sarah">Sarah (Female, Soft)</option>
                                                <option value="Antoni">Antoni (Male, Friendly)</option>
                                                <option value="Adam">Adam (Male, Deep)</option>
                                                <option value="Charlotte">Charlotte (Female, British)</option>
                                                <option value="Matilda">Matilda (Female, Warm)</option>
                                            </select>
                                            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none">expand_more</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-text-secondary">Speech Speed</label>
                                        <div className="flex items-center gap-4">
                                            <input
                                                className="flex-1 h-2 bg-border-dark rounded-lg appearance-none cursor-pointer"
                                                type="range"
                                                min="0.5"
                                                max="2"
                                                step="0.1"
                                                value={settings.voiceSpeed || 1.0}
                                                onChange={(e) => setSettings(prev => ({ ...prev, voiceSpeed: parseFloat(e.target.value) }))}
                                            />
                                            <span className="text-sm font-mono text-primary w-12">{(settings.voiceSpeed || 1.0).toFixed(1)}x</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={async () => {
                                        try {
                                            const response = await fetch(`${API_URL}/tts/speak`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                credentials: 'include',
                                                body: JSON.stringify({
                                                    text: "Hello! I'll be your AI presentation coach today.",
                                                    voice: settings.voiceId || 'Rachel'
                                                })
                                            })

                                            if (!response.ok) {
                                                const error = await response.json()
                                                throw new Error(error.error || 'TTS failed')
                                            }

                                            const blob = await response.blob()
                                            const audio = new Audio(URL.createObjectURL(blob))
                                            audio.playbackRate = settings.voiceSpeed || 1.0
                                            audio.play()
                                        } catch (e) {
                                            console.error('TTS test failed:', e)
                                            // Fallback to browser TTS
                                            const utterance = new SpeechSynthesisUtterance("Hello! I'll be your AI presentation coach today.")
                                            utterance.rate = settings.voiceSpeed || 1.0
                                            window.speechSynthesis.speak(utterance)
                                        }
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/30 rounded-lg hover:bg-primary/20 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">volume_up</span>
                                    Test Voice
                                </button>
                            </div>
                        </section>

                        {/* Save Button */}
                        <div className="sticky bottom-0 -mx-8 px-8 py-6 bg-background-dark border-t border-border-dark flex justify-end gap-4 mt-12 z-20 shadow-[0_-20px_40px_rgba(0,0,0,0.7)]">
                            <button
                                onClick={handleDiscard}
                                className="px-8 py-2.5 rounded-lg text-sm font-bold text-white hover:bg-surface-dark border border-white/10 hover:border-white/30 transition-all disabled:opacity-50"
                                disabled={saving}
                            >
                                Discard
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-8 py-2.5 rounded-lg text-sm font-bold bg-primary text-white hover:bg-blue-600 shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {saving ? (
                                    <>
                                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                                        Saving...
                                    </>
                                ) : (
                                    'Save Changes'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
