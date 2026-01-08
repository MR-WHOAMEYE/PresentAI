import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AuthPage() {
    const [mode, setMode] = useState('login') // 'login' | 'signup'
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const { loginWithGoogle, loginWithEmail, signUpWithEmail, getErrorMessage, isAuthenticated } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    // Redirect if already authenticated
    if (isAuthenticated) {
        const from = location.state?.from?.pathname || '/dashboard'
        navigate(from, { replace: true })
    }

    async function handleGoogleLogin() {
        setError('')
        setLoading(true)
        try {
            await loginWithGoogle()
            navigate('/dashboard')
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setLoading(false)
        }
    }

    async function handleEmailSubmit(e) {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            if (mode === 'signup') {
                await signUpWithEmail(email, password, name)
            } else {
                await loginWithEmail(email, password)
            }
            navigate('/dashboard')
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-background-dark flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link to="/" className="inline-flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-2xl">present_to_all</span>
                        </div>
                        <span className="text-2xl font-bold text-white">PresentAI</span>
                    </Link>
                    <p className="text-zinc-400 mt-3">
                        {mode === 'login' ? 'Welcome back! Sign in to continue.' : 'Create your account to get started.'}
                    </p>
                </div>

                {/* Auth Card */}
                <div className="bg-surface-dark border border-border-dark rounded-2xl p-6 md:p-8">
                    {/* Mode Toggle */}
                    <div className="flex bg-background-dark rounded-lg p-1 mb-6">
                        <button
                            onClick={() => setMode('login')}
                            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${mode === 'login'
                                    ? 'bg-surface-dark text-white shadow-sm'
                                    : 'text-zinc-400 hover:text-white'
                                }`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => setMode('signup')}
                            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${mode === 'signup'
                                    ? 'bg-surface-dark text-white shadow-sm'
                                    : 'text-zinc-400 hover:text-white'
                                }`}
                        >
                            Sign Up
                        </button>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-start gap-2">
                            <span className="material-symbols-outlined text-[18px] mt-0.5">error</span>
                            {error}
                        </div>
                    )}

                    {/* Google Sign In */}
                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-medium py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continue with Google
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-4 my-6">
                        <div className="flex-1 h-px bg-border-dark"></div>
                        <span className="text-zinc-500 text-sm">or</span>
                        <div className="flex-1 h-px bg-border-dark"></div>
                    </div>

                    {/* Email Form */}
                    <form onSubmit={handleEmailSubmit} className="space-y-4">
                        {mode === 'signup' && (
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1.5">Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Your name"
                                    className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-primary transition-colors"
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-sm text-zinc-400 mb-1.5">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                                className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-zinc-400 mb-1.5">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={6}
                                className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary text-white font-medium py-3 px-4 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                            ) : (
                                <>
                                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <p className="text-center text-zinc-500 text-sm mt-6">
                        {mode === 'login' ? (
                            <>Don't have an account? <button onClick={() => setMode('signup')} className="text-primary hover:underline">Sign up</button></>
                        ) : (
                            <>Already have an account? <button onClick={() => setMode('login')} className="text-primary hover:underline">Sign in</button></>
                        )}
                    </p>
                </div>

                {/* Terms */}
                <p className="text-center text-zinc-600 text-xs mt-6">
                    By continuing, you agree to our Terms of Service and Privacy Policy.
                </p>
            </div>
        </div>
    )
}
